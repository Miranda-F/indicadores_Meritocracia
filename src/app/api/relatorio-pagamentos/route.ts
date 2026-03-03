import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { spawn } from 'child_process'
import { writeFile, readFile, unlink } from 'fs/promises'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get('periodo')
    
    if (!periodo) {
      return NextResponse.json({ error: 'Período é obrigatório' }, { status: 400 })
    }

    // Buscar todos os colaboradores com suas coletas do período
    const colaboradores = await db.colaborador.findMany({
      where: { ativo: true },
      include: {
        setor: {
          include: { departamento: true }
        },
        indicadores: {
          include: {
            coletas: {
              where: { periodo }
            }
          }
        }
      },
      orderBy: { nome: 'asc' }
    })

    // Calcular bônus total por colaborador
    const pagamentos = colaboradores
      .map(c => {
        const bonusTotal = c.indicadores.reduce((sum, ind) => {
          return sum + ind.coletas.reduce((s, coleta) => s + coleta.bonusCalculado, 0)
        }, 0)
        
        return {
          nome: c.nome,
          funcao: c.funcao,
          setor: c.setor.nome,
          departamento: c.setor.departamento.nome,
          bonusTotal
        }
      })
      .filter(p => p.bonusTotal > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome))

    // Calcular total geral
    const totalGeral = pagamentos.reduce((sum, p) => sum + p.bonusTotal, 0)

    // Gerar PDF usando Python/ReportLab
    const pdfContent = await generatePDF(pagamentos, totalGeral, periodo)
    
    // Retornar PDF
    return new NextResponse(pdfContent, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio-pagamentos-${periodo}.pdf"`
      }
    })
  } catch (error) {
    console.error('Erro ao gerar relatório:', error)
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 })
  }
}

async function generatePDF(
  pagamentos: Array<{
    nome: string
    funcao: string
    setor: string
    departamento: string
    bonusTotal: number
  }>,
  totalGeral: number,
  periodo: string
): Promise<Buffer> {
  // Criar script Python temporário
  const scriptPath = path.join('/tmp', `generate_pdf_${Date.now()}.py`)
  const outputPath = path.join('/tmp', `relatorio_${Date.now()}.pdf`)
  
  // Formatar período para exibição
  const [ano, mes] = periodo.split('-')
  const mesNome = new Date(parseInt(ano), parseInt(mes) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  
  const dataGeracao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  const pythonScript = `
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Registrar fontes
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
registerFontFamily('SimHei', normal='SimHei', bold='SimHei')
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

# Dados
pagamentos = ${JSON.stringify(pagamentos)}
total_geral = ${totalGeral}
periodo = "${mesNome}"
data_geracao = "${dataGeracao}"

# Criar documento
doc = SimpleDocTemplate(
    "${outputPath}",
    pagesize=A4,
    leftMargin=2*cm,
    rightMargin=2*cm,
    topMargin=2*cm,
    bottomMargin=2*cm
)

# Estilos
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    name='TitleStyle',
    fontName='Times New Roman',
    fontSize=24,
    alignment=TA_CENTER,
    spaceAfter=12,
    textColor=colors.HexColor('#1F4E79')
)

subtitle_style = ParagraphStyle(
    name='SubtitleStyle',
    fontName='Times New Roman',
    fontSize=14,
    alignment=TA_CENTER,
    spaceAfter=6,
    textColor=colors.HexColor('#666666')
)

info_style = ParagraphStyle(
    name='InfoStyle',
    fontName='Times New Roman',
    fontSize=11,
    alignment=TA_CENTER,
    spaceAfter=24,
    textColor=colors.HexColor('#888888')
)

header_style = ParagraphStyle(
    name='HeaderStyle',
    fontName='Times New Roman',
    fontSize=11,
    textColor=colors.white,
    alignment=TA_CENTER
)

cell_style = ParagraphStyle(
    name='CellStyle',
    fontName='Times New Roman',
    fontSize=10,
    alignment=TA_LEFT
)

cell_right_style = ParagraphStyle(
    name='CellRightStyle',
    fontName='Times New Roman',
    fontSize=10,
    alignment=TA_RIGHT
)

total_style = ParagraphStyle(
    name='TotalStyle',
    fontName='Times New Roman',
    fontSize=12,
    alignment=TA_RIGHT,
    textColor=colors.HexColor('#1F4E79')
)

footer_style = ParagraphStyle(
    name='FooterStyle',
    fontName='Times New Roman',
    fontSize=9,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#888888')
)

# Construir conteúdo
story = []

# Cabeçalho
story.append(Paragraph("<b>RELATORIO DE PAGAMENTOS</b>", title_style))
story.append(Paragraph("Sistema de Meritocracia", subtitle_style))
story.append(Spacer(1, 6))
story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1F4E79')))
story.append(Spacer(1, 12))
story.append(Paragraph(f"Periodo de Referencia: {periodo}", info_style))
story.append(Paragraph(f"Data de Emissao: {data_geracao}", info_style))
story.append(Spacer(1, 24))

# Tabela de pagamentos
# Cabeçalho
table_data = [
    [
        Paragraph("<b>No.</b>", header_style),
        Paragraph("<b>Colaborador</b>", header_style),
        Paragraph("<b>Setor</b>", header_style),
        Paragraph("<b>Valor a Pagar</b>", header_style)
    ]
]

# Dados
for i, p in enumerate(pagamentos, 1):
    valor_fmt = f"R$ {p['bonusTotal']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    table_data.append([
        Paragraph(str(i), cell_style),
        Paragraph(p['nome'], cell_style),
        Paragraph(f"{p['setor']} / {p['departamento']}", cell_style),
        Paragraph(valor_fmt, cell_right_style)
    ])

# Linha de total
total_fmt = f"R$ {total_geral:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
table_data.append([
    Paragraph("", cell_style),
    Paragraph("", cell_style),
    Paragraph("<b>TOTAL GERAL</b>", ParagraphStyle(name='TotalLabel', fontName='Times New Roman', fontSize=11, alignment=TA_RIGHT)),
    Paragraph(f"<b>{total_fmt}</b>", total_style)
])

# Criar tabela
col_widths = [1.2*cm, 6*cm, 6*cm, 3.5*cm]
table = Table(table_data, colWidths=col_widths, repeatRows=1)

table.setStyle(TableStyle([
    # Cabeçalho
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, 0), 'Times New Roman'),
    ('FONTSIZE', (0, 0), (-1, 0), 11),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
    ('TOPPADDING', (0, 0), (-1, 0), 10),
    
    # Linhas de dados
    ('FONTNAME', (0, 1), (-1, -2), 'Times New Roman'),
    ('FONTSIZE', (0, 1), (-1, -2), 10),
    ('ALIGN', (0, 1), (0, -1), 'CENTER'),
    ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
    ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ('TOPPADDING', (0, 1), (-1, -1), 8),
    
    # Linha de total
    ('BACKGROUND', (2, -1), (-1, -1), colors.HexColor('#E8F0F8')),
    ('LINEABOVE', (2, -1), (-1, -1), 1, colors.HexColor('#1F4E79')),
    
    # Grid
    ('GRID', (0, 0), (-1, -2), 0.5, colors.HexColor('#CCCCCC')),
    ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#1F4E79')),
    
    # Alternância de cores
    ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#F8F8F8')]),
    
    # Alinhamento vertical
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))

story.append(table)
story.append(Spacer(1, 40))

# Rodapé
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CCCCCC')))
story.append(Spacer(1, 12))
story.append(Paragraph("Este relatorio foi gerado automaticamente pelo Sistema de Meritocracia.", footer_style))
story.append(Paragraph("Documento para uso interno - Confidencial", footer_style))

# Gerar PDF
doc.build(story)

print("PDF gerado com sucesso!")
`

  // Escrever script Python
  await writeFile(scriptPath, pythonScript, 'utf-8')
  
  // Executar script Python
  return new Promise((resolve, reject) => {
    const process = spawn('python3', [scriptPath])
    
    let stdout = ''
    let stderr = ''
    
    process.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    process.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    process.on('close', async (code) => {
      try {
        // Ler PDF gerado
        const pdfContent = await readFile(outputPath)
        
        // Limpar arquivos temporários
        await unlink(scriptPath).catch(() => {})
        await unlink(outputPath).catch(() => {})
        
        if (code === 0) {
          resolve(pdfContent)
        } else {
          console.error('Python stderr:', stderr)
          reject(new Error(`Python script failed with code ${code}: ${stderr}`))
        }
      } catch (err) {
        reject(err)
      }
    })
    
    process.on('error', (err) => {
      reject(err)
    })
  })
}
