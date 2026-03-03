'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Users, Target, TrendingUp, DollarSign, Building2, Briefcase, 
  Plus, Upload, Search, CheckCircle, XCircle, Award, BarChart3,
  Calendar, FileSpreadsheet, User, ChevronDown, Pencil, Trash2,
  RefreshCw, Download, AlertCircle, History, Database, Play, Zap
} from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'

interface DashboardData {
  kpis: {
    totalColaboradores: number
    totalIndicadores: number
    totalDepartamentos: number
    totalSetores: number
    metasAtingidas: number
    supermetasAtingidas: number
    coletasSemMeta: number
    totalColetas: number
    totalBonus: number
  }
  departamentosStats: Array<{ nome: string; colaboradores: number }>
  topPerformers: Array<{
    nome: string
    funcao: string
    indicadores: number
    metasAtingidas: number
    supermetasAtingidas: number
    bonusTotal: number
  }>
  performanceDepartamentos: Array<{
    nome: string
    totalIndicadores: number
    metasAtingidas: number
    supermetasAtingidas: number
    totalBonus: number
    taxaSucesso: number
  }>
  performanceSetores: Array<{
    departamento: string
    nome: string
    totalIndicadores: number
    metasAtingidas: number
    supermetasAtingidas: number
    totalBonus: number
    taxaSucesso: number
  }>
  evolucaoMensal: Array<{
    periodo: string
    mes: string
    total: number
    metas: number
    supermetas: number
    naoAtingidas: number
    bonus: number
  }>
  indicadoresTop: Array<{
    nome: string
    colaborador: string
    tipoMeta: string
    taxaSucesso: number
    totalAvaliacoes: number
  }>
  performancePorNivel: Array<{ nivel: number; _count: { id: number } }>
}

interface Colaborador {
  id: string
  nome: string
  funcao: string
  status: string
  nivel: number
  ativo: boolean
  setor: {
    id: string
    nome: string
    departamento: { id: string; nome: string }
  }
  indicadores?: Indicador[]
}

interface Setor {
  id: string
  nome: string
  departamento: { id: string; nome: string }
}

interface Departamento {
  id: string
  nome: string
}

interface Indicador {
  id: string
  nome: string
  medida: string
  frequencia: string
  nivel: number
  tipoMeta: string
  bonusMeta: number
  bonusSupermeta: number
  colaborador: {
    id: string
    nome: string
    funcao: string
    setor: { nome: string; departamento: { nome: string } }
  }
  metas?: Meta[]
  coletas?: Coleta[]
}

interface Meta {
  id: string
  periodo: string
  mes: number
  ano: number
  meta: number
  supermeta: number
  versao?: number
  ativa?: boolean
  historico?: MetaHistorico[]
}

interface MetaHistorico {
  id: string
  metaId: string
  metaAnterior: number
  supermetaAnterior: number
  metaNova: number
  supermetaNova: number
  versaoAnterior: number
  versaoNova: number
  dataAlteracao: string
  motivo?: string
  usuario?: string
  observacao?: string
}

interface Coleta {
  id: string
  periodo: string
  mes: number
  ano: number
  valor: number
  comentario?: string
  atingiuMeta: boolean
  atingiuSupermeta: boolean
  bonusCalculado: number
}

interface FonteDados {
  id: string
  nome: string
  descricao?: string
  url: string
  metodo: string
  headers?: string
  body?: string
  tipoAutenticacao: string
  tokenAutenticacao?: string
  headerAuthName?: string
  mapeamento?: string
  campoValor: string
  indicadorId?: string
  indicador?: Indicador
  ativo: boolean
  ultimaSincronizacao?: string
  statusUltimaSync?: string
  mensagemErro?: string
  createdAt: string
}

export default function MeritocraciaSystem() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const now = new Date()
  const [mesSelecionado, setMesSelecionado] = useState(now.getMonth() + 1)
  const [anoSelecionado, setAnoSelecionado] = useState(now.getFullYear())
  
  // Período calculado
  const periodoSelecionado = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}`
  
  // Estados dos dados
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [indicadores, setIndicadores] = useState<Indicador[]>([])
  const [coletas, setColetas] = useState<Coleta[]>([])
  const [fontesDados, setFontesDados] = useState<FonteDados[]>([])
  
  // Estados de loading
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [testingFonte, setTestingFonte] = useState<string | null>(null)
  const [syncingFonte, setSyncingFonte] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  
  // Estados de filtros
  const [searchColaborador, setSearchColaborador] = useState('')
  const [filterDepartamento, setFilterDepartamento] = useState('')
  const [filterSetor, setFilterSetor] = useState('')
  
  // Estados de dialogs
  const [dialogColaboradorOpen, setDialogColaboradorOpen] = useState(false)
  const [dialogIndicadorOpen, setDialogIndicadorOpen] = useState(false)
  const [dialogColetaOpen, setDialogColetaOpen] = useState(false)
  const [dialogMetaOpen, setDialogMetaOpen] = useState(false)
  const [dialogHistoricoOpen, setDialogHistoricoOpen] = useState(false)
  const [dialogFonteDadosOpen, setDialogFonteDadosOpen] = useState(false)
  const [dialogTestResultOpen, setDialogTestResultOpen] = useState(false)
  
  // Estados de edição
  const [colaboradorEditando, setColaboradorEditando] = useState<Colaborador | null>(null)
  const [indicadorEditando, setIndicadorEditando] = useState<Indicador | null>(null)
  const [indicadorColeta, setIndicadorColeta] = useState<Indicador | null>(null)
  const [indicadorMeta, setIndicadorMeta] = useState<Indicador | null>(null)
  const [historicoMeta, setHistoricoMeta] = useState<MetaHistorico[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [fonteEditando, setFonteEditando] = useState<FonteDados | null>(null)
  const [testResult, setTestResult] = useState<{success: boolean; status?: number; responseTime?: number; data?: unknown; valorExtraido?: unknown; error?: string} | null>(null)
  
  // Form states
  const [formColaborador, setFormColaborador] = useState({
    nome: '', funcao: '', status: 'A', nivel: 1, setorId: ''
  })
  const [formIndicador, setFormIndicador] = useState({
    nome: '', medida: 'R$', frequencia: 'Mensal', nivel: 1, tipoMeta: 'maior_que', bonusMeta: 0, bonusSupermeta: 0, colaboradorId: ''
  })
  const [formColeta, setFormColeta] = useState({
    periodo: periodoSelecionado, mes: 1, ano: 2026, valor: 0, comentario: ''
  })
  const [formMeta, setFormMeta] = useState({
    periodo: periodoSelecionado, mes: 1, ano: 2026, meta: 0, supermeta: 0, motivo: '', observacao: '', usuario: ''
  })
  const [formFonteDados, setFormFonteDados] = useState({
    nome: '',
    descricao: '',
    url: '',
    metodo: 'GET',
    headers: '',
    body: '',
    tipoAutenticacao: 'Nenhuma',
    tokenAutenticacao: '',
    headerAuthName: '',
    campoValor: 'valor',
    indicadorId: '',
    ativo: true
  })

  // Funções de carregamento
  const loadDashboard = useCallback(async () => {
    try {
      const periodo = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}`
      const res = await fetch(`/api/dashboard?periodo=${periodo}`)
      const data = await res.json()
      setDashboardData(data)
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    }
  }, [mesSelecionado, anoSelecionado])

  const loadColaboradores = useCallback(async () => {
    try {
      const res = await fetch('/api/colaboradores')
      const data = await res.json()
      setColaboradores(data)
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error)
    }
  }, [])

  const loadSetores = useCallback(async () => {
    try {
      const res = await fetch('/api/setores')
      const data = await res.json()
      setSetores(data)
    } catch (error) {
      console.error('Erro ao carregar setores:', error)
    }
  }, [])

  const loadDepartamentos = useCallback(async () => {
    try {
      const res = await fetch('/api/departamentos')
      const data = await res.json()
      setDepartamentos(data)
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error)
    }
  }, [])

  const loadIndicadores = useCallback(async () => {
    try {
      const res = await fetch('/api/indicadores')
      const data = await res.json()
      setIndicadores(data)
    } catch (error) {
      console.error('Erro ao carregar indicadores:', error)
    }
  }, [])

  const loadFontesDados = useCallback(async () => {
    try {
      const res = await fetch('/api/fontes-dados')
      const data = await res.json()
      setFontesDados(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao carregar fontes de dados:', error)
      setFontesDados([])
    }
  }, [])

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        loadDashboard(),
        loadColaboradores(),
        loadSetores(),
        loadDepartamentos(),
        loadIndicadores(),
        loadFontesDados()
      ])
      setLoading(false)
    }
    loadData()
  }, [loadDashboard, loadColaboradores, loadSetores, loadDepartamentos, loadIndicadores, loadFontesDados])

  // Atualizar dashboard quando período mudar
  useEffect(() => {
    loadDashboard()
  }, [mesSelecionado, anoSelecionado, loadDashboard])

  // Funções de CRUD
  const handleSaveColaborador = async () => {
    try {
      const url = colaboradorEditando 
        ? `/api/colaboradores/${colaboradorEditando.id}`
        : '/api/colaboradores'
      const method = colaboradorEditando ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formColaborador)
      })
      
      if (res.ok) {
        toast({ title: colaboradorEditando ? 'Colaborador atualizado!' : 'Colaborador criado!' })
        setDialogColaboradorOpen(false)
        loadColaboradores()
        resetFormColaborador()
      } else {
        toast({ title: 'Erro ao salvar colaborador', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao salvar colaborador', variant: 'destructive' })
    }
  }

  const handleDeleteColaborador = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este colaborador?')) return
    
    try {
      const res = await fetch(`/api/colaboradores/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Colaborador excluído!' })
        loadColaboradores()
      }
    } catch (error) {
      toast({ title: 'Erro ao excluir colaborador', variant: 'destructive' })
    }
  }

  const handleSaveIndicador = async () => {
    try {
      const url = indicadorEditando 
        ? `/api/indicadores/${indicadorEditando.id}`
        : '/api/indicadores'
      const method = indicadorEditando ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formIndicador)
      })
      
      if (res.ok) {
        toast({ title: indicadorEditando ? 'Indicador atualizado!' : 'Indicador criado!' })
        setDialogIndicadorOpen(false)
        loadIndicadores()
        resetFormIndicador()
      }
    } catch (error) {
      toast({ title: 'Erro ao salvar indicador', variant: 'destructive' })
    }
  }

  const handleDeleteIndicador = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este indicador?')) return
    
    try {
      const res = await fetch(`/api/indicadores/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Indicador excluído!' })
        loadIndicadores()
      }
    } catch (error) {
      toast({ title: 'Erro ao excluir indicador', variant: 'destructive' })
    }
  }

  const handleSaveColeta = async () => {
    if (!indicadorColeta) return
    
    try {
      const [ano, mes] = formColeta.periodo.split('-').map(Number)
      
      const res = await fetch('/api/coletas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indicadorId: indicadorColeta.id,
          periodo: formColeta.periodo,
          mes,
          ano,
          valor: formColeta.valor,
          comentario: formColeta.comentario
        })
      })
      
      if (res.ok) {
        toast({ title: 'Coleta registrada!' })
        setDialogColetaOpen(false)
        loadIndicadores()
        loadDashboard()
      }
    } catch (error) {
      toast({ title: 'Erro ao salvar coleta', variant: 'destructive' })
    }
  }

  const handleSaveMeta = async () => {
    if (!indicadorMeta) return
    
    try {
      const [ano, mes] = formMeta.periodo.split('-').map(Number)
      
      const res = await fetch('/api/historico-metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indicadorId: indicadorMeta.id,
          periodo: formMeta.periodo,
          mes,
          ano,
          meta: formMeta.meta,
          supermeta: formMeta.supermeta,
          motivo: formMeta.motivo,
          observacao: formMeta.observacao,
          usuario: formMeta.usuario
        })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        toast({ 
          title: data.alteracao ? 'Meta atualizada!' : 'Meta definida!',
          description: data.alteracao ? `Versão ${data.meta.versao} registrada` : undefined
        })
        setDialogMetaOpen(false)
        loadIndicadores()
      }
    } catch (error) {
      toast({ title: 'Erro ao salvar meta', variant: 'destructive' })
    }
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      
      if (res.ok) {
        toast({ 
          title: 'Importação concluída!', 
          description: `${data.stats.colaboradoresCriados} colaboradores, ${data.stats.indicadoresCriados} indicadores importados`
        })
        // Recarregar todos os dados
        await Promise.all([
          loadDashboard(),
          loadColaboradores(),
          loadSetores(),
          loadDepartamentos(),
          loadIndicadores()
        ])
      } else {
        toast({ title: 'Erro na importação', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro na importação', variant: 'destructive' })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  // Reset forms
  const resetFormColaborador = () => {
    setFormColaborador({ nome: '', funcao: '', status: 'A', nivel: 1, setorId: '' })
    setColaboradorEditando(null)
  }

  const resetFormIndicador = () => {
    setFormIndicador({ nome: '', medida: 'R$', frequencia: 'Mensal', nivel: 1, tipoMeta: 'maior_que', bonusMeta: 0, bonusSupermeta: 0, colaboradorId: '' })
    setIndicadorEditando(null)
  }

  // Editar colaborador
  const openEditColaborador = (colab: Colaborador) => {
    setColaboradorEditando(colab)
    setFormColaborador({
      nome: colab.nome,
      funcao: colab.funcao,
      status: colab.status,
      nivel: colab.nivel,
      setorId: colab.setor.id
    })
    setDialogColaboradorOpen(true)
  }

  // Editar indicador
  const openEditIndicador = (ind: Indicador) => {
    setIndicadorEditando(ind)
    setFormIndicador({
      nome: ind.nome,
      medida: ind.medida,
      frequencia: ind.frequencia,
      nivel: ind.nivel,
      tipoMeta: ind.tipoMeta || 'maior_que',
      bonusMeta: ind.bonusMeta,
      bonusSupermeta: ind.bonusSupermeta,
      colaboradorId: ind.colaborador.id
    })
    setDialogIndicadorOpen(true)
  }

  // Abrir dialog de coleta
  const openColetaDialog = (ind: Indicador) => {
    setIndicadorColeta(ind)
    const [ano, mes] = periodoSelecionado.split('-').map(Number)
    setFormColeta({
      periodo: periodoSelecionado,
      mes,
      ano,
      valor: 0,
      comentario: ''
    })
    setDialogColetaOpen(true)
  }

  // Abrir dialog de meta
  const openMetaDialog = (ind: Indicador) => {
    setIndicadorMeta(ind)
    const [ano, mes] = periodoSelecionado.split('-').map(Number)
    
    // Verificar se já existe meta para o período
    const metaExistente = ind.metas?.find(m => m.periodo === periodoSelecionado)
    
    setFormMeta({
      periodo: periodoSelecionado,
      mes,
      ano,
      meta: metaExistente?.meta || 0,
      supermeta: metaExistente?.supermeta || 0,
      motivo: '',
      observacao: '',
      usuario: ''
    })
    setDialogMetaOpen(true)
  }

  const openHistoricoDialog = async (ind: Indicador) => {
    setIndicadorMeta(ind)
    setLoadingHistorico(true)
    setDialogHistoricoOpen(true)

    try {
      const res = await fetch(`/api/historico-metas?indicadorId=${ind.id}&periodo=${periodoSelecionado}`)
      const data = await res.json()
      setHistoricoMeta(data.historico || [])
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
      setHistoricoMeta([])
    } finally {
      setLoadingHistorico(false)
    }
  }

  // CRUD Fonte de Dados
  const handleSaveFonteDados = async () => {
    try {
      const url = fonteEditando
        ? `/api/fontes-dados/${fonteEditando.id}`
        : '/api/fontes-dados'
      const method = fonteEditando ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formFonteDados)
      })

      if (res.ok) {
        toast({ title: fonteEditando ? 'Fonte de dados atualizada!' : 'Fonte de dados criada!' })
        setDialogFonteDadosOpen(false)
        loadFontesDados()
        resetFormFonteDados()
      } else {
        toast({ title: 'Erro ao salvar fonte de dados', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao salvar fonte de dados', variant: 'destructive' })
    }
  }

  const handleDeleteFonteDados = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fonte de dados?')) return

    try {
      const res = await fetch(`/api/fontes-dados/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Fonte de dados excluída!' })
        loadFontesDados()
      }
    } catch (error) {
      toast({ title: 'Erro ao excluir fonte de dados', variant: 'destructive' })
    }
  }

  const resetFormFonteDados = () => {
    setFormFonteDados({
      nome: '',
      descricao: '',
      url: '',
      metodo: 'GET',
      headers: '',
      body: '',
      tipoAutenticacao: 'Nenhuma',
      tokenAutenticacao: '',
      headerAuthName: '',
      campoValor: 'valor',
      indicadorId: '',
      ativo: true
    })
    setFonteEditando(null)
  }

  const openEditFonteDados = (fonte: FonteDados) => {
    setFonteEditando(fonte)
    setFormFonteDados({
      nome: fonte.nome,
      descricao: fonte.descricao || '',
      url: fonte.url,
      metodo: fonte.metodo,
      headers: fonte.headers || '',
      body: fonte.body || '',
      tipoAutenticacao: fonte.tipoAutenticacao,
      tokenAutenticacao: fonte.tokenAutenticacao || '',
      headerAuthName: fonte.headerAuthName || '',
      campoValor: fonte.campoValor,
      indicadorId: fonte.indicadorId || '',
      ativo: fonte.ativo
    })
    setDialogFonteDadosOpen(true)
  }

  const handleTestFonteDados = async (fonte: FonteDados) => {
    setTestingFonte(fonte.id)
    try {
      const res = await fetch(`/api/fontes-dados/${fonte.id}/testar`, { method: 'POST' })
      const data = await res.json()
      setTestResult(data)
      setDialogTestResultOpen(true)
      loadFontesDados()
    } catch (error) {
      setTestResult({ success: false, error: 'Erro ao testar conexão' })
      setDialogTestResultOpen(true)
    } finally {
      setTestingFonte(null)
    }
  }

  const handleSyncFonteDados = async (fonte: FonteDados, syncAll: boolean = false) => {
    setSyncingFonte(fonte.id)
    try {
      const res = await fetch(`/api/fontes-dados/${fonte.id}/sincronizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          periodo: periodoSelecionado,
          modo: syncAll ? 'completo' : 'periodo'
        })
      })
      const data = await res.json()

      if (data.success) {
        if (syncAll) {
          toast({
            title: 'Sincronização completa!',
            description: `${data.sucessos} períodos sincronizados, ${data.semValores} sem valor, ${data.erros} erros`
          })
        } else {
          toast({
            title: 'Sincronização concluída!',
            description: `Valor: ${data.valor?.toLocaleString('pt-BR')}`
          })
        }
        loadFontesDados()
        loadIndicadores()
        loadDashboard()
      } else {
        toast({ title: 'Erro na sincronização', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro na sincronização', variant: 'destructive' })
    } finally {
      setSyncingFonte(null)
    }
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const response = await fetch(`/api/relatorio-pagamentos?periodo=${periodoSelecionado}`)
      
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `relatorio-pagamentos-${periodoSelecionado}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({ title: 'Relatório gerado com sucesso!' })
    } catch (error) {
      toast({ title: 'Erro ao gerar relatório', variant: 'destructive' })
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Filtrar colaboradores
  const colaboradoresFiltrados = colaboradores.filter(c => {
    const matchSearch = c.nome.toLowerCase().includes(searchColaborador.toLowerCase()) ||
                        c.funcao.toLowerCase().includes(searchColaborador.toLowerCase())
    const matchDepto = !filterDepartamento || filterDepartamento === '_todos' || c.setor.departamento.id === filterDepartamento
    const matchSetor = !filterSetor || filterSetor === '_todos' || c.setor.id === filterSetor
    return matchSearch && matchDepto && matchSetor
  })

  // Filtrar setores por departamento
  const setoresFiltrados = filterDepartamento && filterDepartamento !== '_todos'
    ? setores.filter(s => s.departamento.id === filterDepartamento)
    : setores

  // Filtrar indicadores por colaborador, departamento e setor
  const indicadoresFiltrados = indicadores.filter(ind => {
    const matchSearch = !searchColaborador ||
                        ind.colaborador.nome.toLowerCase().includes(searchColaborador.toLowerCase()) ||
                        ind.colaborador.funcao.toLowerCase().includes(searchColaborador.toLowerCase()) ||
                        ind.nome.toLowerCase().includes(searchColaborador.toLowerCase())
    const matchDepto = !filterDepartamento || filterDepartamento === '_todos' || ind.colaborador.setor.departamento.id === filterDepartamento
    const matchSetor = !filterSetor || filterSetor === '_todos' || ind.colaborador.setor.id === filterSetor
    return matchSearch && matchDepto && matchSetor
  })

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Award className="h-7 w-7 text-primary" />
                Sistema de Meritocracia
              </h1>
              <p className="text-muted-foreground text-sm">Gestão de Indicadores e Bônus</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(mesSelecionado)} onValueChange={v => setMesSelecionado(parseInt(v))}>
                <SelectTrigger className="w-36">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: '1', label: 'Janeiro' },
                    { value: '2', label: 'Fevereiro' },
                    { value: '3', label: 'Março' },
                    { value: '4', label: 'Abril' },
                    { value: '5', label: 'Maio' },
                    { value: '6', label: 'Junho' },
                    { value: '7', label: 'Julho' },
                    { value: '8', label: 'Agosto' },
                    { value: '9', label: 'Setembro' },
                    { value: '10', label: 'Outubro' },
                    { value: '11', label: 'Novembro' },
                    { value: '12', label: 'Dezembro' },
                  ].map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={String(anoSelecionado)} onValueChange={v => setAnoSelecionado(parseInt(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027, 2028].map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  className="hidden"
                  disabled={importing}
                />
                <Button variant="outline" asChild disabled={importing}>
                  <span>
                    {importing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {importing ? 'Importando...' : 'Importar Excel'}
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="colaboradores" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Colaboradores</span>
            </TabsTrigger>
            <TabsTrigger value="indicadores" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Indicadores</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="fontes" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Fontes</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="space-y-6">
              {/* KPIs Principais */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Users className="h-4 w-4" /> Colaboradores Ativos
                    </CardDescription>
                    <CardTitle className="text-3xl text-blue-700 dark:text-blue-300">{dashboardData?.kpis.totalColaboradores || 0}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                      <Target className="h-4 w-4" /> Indicadores
                    </CardDescription>
                    <CardTitle className="text-3xl text-purple-700 dark:text-purple-300">{dashboardData?.kpis.totalIndicadores || 0}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" /> Metas Atingidas
                    </CardDescription>
                    <CardTitle className="text-3xl text-green-700 dark:text-green-300">
                      {(dashboardData?.kpis.metasAtingidas || 0) + (dashboardData?.kpis.supermetasAtingidas || 0)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <DollarSign className="h-4 w-4" /> Bônus Total
                    </CardDescription>
                    <CardTitle className="text-2xl text-amber-700 dark:text-amber-300">{formatCurrency(dashboardData?.kpis.totalBonus || 0)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Status Distribution & Evolução */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Distribuição de Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BarChart3 className="h-5 w-5" /> Distribuição de Status
                    </CardTitle>
                    <CardDescription>
                      {periodoSelecionado && new Date(periodoSelecionado + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboardData?.kpis.totalColetas ? (
                      <div className="space-y-4">
                        {/* Supermeta */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-green-600 font-medium">Supermeta</span>
                            <span>{dashboardData.kpis.supermetasAtingidas} ({((dashboardData.kpis.supermetasAtingidas / dashboardData.kpis.totalColetas) * 100).toFixed(1)}%)</span>
                          </div>
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full transition-all duration-500"
                              style={{ width: `${(dashboardData.kpis.supermetasAtingidas / dashboardData.kpis.totalColetas) * 100}%` }}
                            />
                          </div>
                        </div>
                        {/* Meta */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-blue-600 font-medium">Meta</span>
                            <span>{dashboardData.kpis.metasAtingidas} ({((dashboardData.kpis.metasAtingidas / dashboardData.kpis.totalColetas) * 100).toFixed(1)}%)</span>
                          </div>
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${(dashboardData.kpis.metasAtingidas / dashboardData.kpis.totalColetas) * 100}%` }}
                            />
                          </div>
                        </div>
                        {/* Não Atingida */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-red-600 font-medium">Não Atingida</span>
                            <span>{dashboardData.kpis.coletasSemMeta} ({((dashboardData.kpis.coletasSemMeta / dashboardData.kpis.totalColetas) * 100).toFixed(1)}%)</span>
                          </div>
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-red-500 rounded-full transition-all duration-500"
                              style={{ width: `${(dashboardData.kpis.coletasSemMeta / dashboardData.kpis.totalColetas) * 100}%` }}
                            />
                          </div>
                        </div>
                        {/* Taxa de Sucesso */}
                        <div className="pt-4 border-t">
                          <div className="text-center">
                            <p className="text-3xl font-bold text-green-600">
                              {(((dashboardData.kpis.metasAtingidas + dashboardData.kpis.supermetasAtingidas) / dashboardData.kpis.totalColetas) * 100).toFixed(1)}%
                            </p>
                            <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p>Sem coletas no período</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Evolução Mensal */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="h-5 w-5" /> Evolução Mensal
                    </CardTitle>
                    <CardDescription>Últimos 6 meses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dashboardData?.evolucaoMensal?.slice().reverse().map((m, i) => {
                        const maxTotal = Math.max(...(dashboardData?.evolucaoMensal?.map(e => e.total) || [1]))
                        const metaPct = m.total > 0 ? (m.metas / m.total) * 100 : 0
                        const superPct = m.total > 0 ? (m.supermetas / m.total) * 100 : 0
                        
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-16 text-sm font-medium">{m.mes}</div>
                            <div className="flex-1">
                              <div className="h-6 bg-gray-100 rounded overflow-hidden flex">
                                {superPct > 0 && (
                                  <div 
                                    className="h-full bg-green-500 transition-all duration-500"
                                    style={{ width: `${superPct}%` }}
                                    title={`Supermeta: ${m.supermetas}`}
                                  />
                                )}
                                {metaPct > 0 && (
                                  <div 
                                    className="h-full bg-blue-500 transition-all duration-500"
                                    style={{ width: `${metaPct}%` }}
                                    title={`Meta: ${m.metas}`}
                                  />
                                )}
                              </div>
                            </div>
                            <div className="w-20 text-right">
                              <span className="text-sm font-medium">{formatCurrency(m.bonus)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded" />
                        <span className="text-xs">Supermeta</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded" />
                        <span className="text-xs">Meta</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-200 rounded" />
                        <span className="text-xs">Não atingida</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance por Departamento e Top Performers */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Performance por Departamento */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building2 className="h-5 w-5" /> Performance por Departamento
                    </CardTitle>
                    <CardDescription>
                      {periodoSelecionado && new Date(periodoSelecionado + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {dashboardData?.performanceDepartamentos && dashboardData.performanceDepartamentos.length > 0 ? (
                        <div className="space-y-3">
                          {dashboardData.performanceDepartamentos.map((d, i) => {
                            const totalAtingidas = d.metasAtingidas + d.supermetasAtingidas
                            const taxa = d.totalIndicadores > 0 ? (totalAtingidas / d.totalIndicadores) * 100 : 0
                            
                            return (
                              <div key={i} className="p-3 rounded-lg bg-muted/50">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <p className="font-medium text-sm">{d.nome}</p>
                                    <p className="text-xs text-muted-foreground">{d.totalIndicadores} indicadores</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-sm text-primary">{formatCurrency(d.totalBonus)}</p>
                                    <p className="text-xs text-muted-foreground">{d.supermetasAtingidas} supermetas</p>
                                  </div>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(taxa, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mb-2" />
                          <p className="text-sm">Sem dados para o período</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Top Performers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Award className="h-5 w-5" /> Top Performers
                    </CardTitle>
                    <CardDescription>
                      {periodoSelecionado && new Date(periodoSelecionado + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {dashboardData?.topPerformers && dashboardData.topPerformers.length > 0 ? (
                        <div className="space-y-2">
                          {dashboardData.topPerformers.map((p, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-700' : 'bg-gray-300'
                              }`}>
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{p.nome}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.funcao}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm text-primary">{formatCurrency(p.bonusTotal)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {p.supermetasAtingidas}S {p.metasAtingidas}M
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mb-2" />
                          <p className="text-sm">Sem dados para o período</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Top Setores e Indicadores */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Top Setores */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Briefcase className="h-5 w-5" /> Top Setores
                    </CardTitle>
                    <CardDescription>Por bônus total no período</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      {dashboardData?.performanceSetores && dashboardData.performanceSetores.length > 0 ? (
                        <div className="space-y-2">
                          {dashboardData.performanceSetores.slice(0, 8).map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30">
                              <div>
                                <p className="text-sm font-medium">{s.nome}</p>
                                <p className="text-xs text-muted-foreground">{s.departamento}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-green-600">{formatCurrency(s.totalBonus)}</p>
                                <p className="text-xs text-muted-foreground">{s.supermetasAtingidas} supermetas</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                          <p className="text-sm">Sem dados</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Indicadores com Melhor Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="h-5 w-5" /> Indicadores Destaque
                    </CardTitle>
                    <CardDescription>Maior taxa de sucesso (mín. 3 avaliações)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      {dashboardData?.indicadoresTop && dashboardData.indicadoresTop.length > 0 ? (
                        <div className="space-y-2">
                          {dashboardData.indicadoresTop.map((ind, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30">
                              <div className="flex-1 min-w-0 mr-2">
                                <p className="text-sm font-medium truncate">{ind.nome}</p>
                                <p className="text-xs text-muted-foreground truncate">{ind.colaborador}</p>
                              </div>
                              <Badge variant={ind.taxaSucesso >= 80 ? 'default' : 'secondary'} className="shrink-0">
                                {ind.taxaSucesso.toFixed(0)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                          <p className="text-sm">Sem dados suficientes</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Colaboradores Tab */}
          <TabsContent value="colaboradores">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Gestão de Colaboradores</CardTitle>
                    <CardDescription>Gerencie os colaboradores do sistema</CardDescription>
                  </div>
                  <Dialog open={dialogColaboradorOpen} onOpenChange={(open) => { setDialogColaboradorOpen(open); if (!open) resetFormColaborador(); }}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Colaborador
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{colaboradorEditando ? 'Editar' : 'Novo'} Colaborador</DialogTitle>
                        <DialogDescription>
                          {colaboradorEditando ? 'Atualize os dados do colaborador' : 'Preencha os dados do novo colaborador'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="nome">Nome</Label>
                          <Input
                            id="nome"
                            value={formColaborador.nome}
                            onChange={e => setFormColaborador({ ...formColaborador, nome: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="funcao">Função</Label>
                          <Input
                            id="funcao"
                            value={formColaborador.funcao}
                            onChange={e => setFormColaborador({ ...formColaborador, funcao: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="status">Status</Label>
                            <Select value={formColaborador.status} onValueChange={v => setFormColaborador({ ...formColaborador, status: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="A">Ativo</SelectItem>
                                <SelectItem value="I">Inativo</SelectItem>
                                <SelectItem value="F">Férias</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="nivel">Nível</Label>
                            <Select value={String(formColaborador.nivel)} onValueChange={v => setFormColaborador({ ...formColaborador, nivel: parseInt(v) })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                  <SelectItem key={n} value={String(n)}>Nível {n}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="setor">Setor</Label>
                          <Select value={formColaborador.setorId} onValueChange={v => setFormColaborador({ ...formColaborador, setorId: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um setor" />
                            </SelectTrigger>
                            <SelectContent>
                              {setores.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.departamento.nome} - {s.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setDialogColaboradorOpen(false); resetFormColaborador(); }}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveColaborador}>
                          {colaboradorEditando ? 'Atualizar' : 'Criar'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filtros */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar colaborador..."
                        value={searchColaborador}
                        onChange={e => setSearchColaborador(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={filterDepartamento} onValueChange={setFilterDepartamento}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_todos">Todos</SelectItem>
                      {departamentos.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterSetor} onValueChange={setFilterSetor}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Setor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_todos">Todos</SelectItem>
                      {setoresFiltrados.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tabela */}
                <div className="border rounded-lg">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Função</TableHead>
                          <TableHead>Departamento</TableHead>
                          <TableHead>Setor</TableHead>
                          <TableHead>Nível</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Indicadores</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {colaboradoresFiltrados.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              Nenhum colaborador encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          colaboradoresFiltrados.map(c => (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">{c.nome}</TableCell>
                              <TableCell>{c.funcao}</TableCell>
                              <TableCell>{c.setor.departamento.nome}</TableCell>
                              <TableCell>{c.setor.nome}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{c.nivel}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={c.status === 'A' ? 'default' : c.status === 'F' ? 'secondary' : 'destructive'}>
                                  {c.status === 'A' ? 'Ativo' : c.status === 'F' ? 'Férias' : 'Inativo'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{c.indicadores?.length || 0}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditColaborador(c)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteColaborador(c.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Indicadores Tab */}
          <TabsContent value="indicadores">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Gestão de Indicadores</CardTitle>
                    <CardDescription>Gerencie os indicadores de meritocracia</CardDescription>
                  </div>
                  <Dialog open={dialogIndicadorOpen} onOpenChange={(open) => { setDialogIndicadorOpen(open); if (!open) resetFormIndicador(); }}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Indicador
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{indicadorEditando ? 'Editar' : 'Novo'} Indicador</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="indNome">Nome do Indicador</Label>
                          <Input
                            id="indNome"
                            value={formIndicador.nome}
                            onChange={e => setFormIndicador({ ...formIndicador, nome: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="medida">Medida</Label>
                            <Select value={formIndicador.medida} onValueChange={v => setFormIndicador({ ...formIndicador, medida: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="R$">R$</SelectItem>
                                <SelectItem value="%">%</SelectItem>
                                <SelectItem value="un">Unidade</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="frequencia">Frequência</Label>
                            <Select value={formIndicador.frequencia} onValueChange={v => setFormIndicador({ ...formIndicador, frequencia: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Mensal">Mensal</SelectItem>
                                <SelectItem value="Semanal">Semanal</SelectItem>
                                <SelectItem value="Diária">Diária</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="tipoMeta">Tipo de Meta</Label>
                          <Select value={formIndicador.tipoMeta} onValueChange={v => setFormIndicador({ ...formIndicador, tipoMeta: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="maior_que">Maior que (Receitas/Vendas)</SelectItem>
                              <SelectItem value="menor_que">Menor que (Custos/Despesas)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Define se o valor deve ser maior (receitas) ou menor (custos) que a meta
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="bonusMeta">Bônus Meta</Label>
                            <Input
                              id="bonusMeta"
                              type="number"
                              value={formIndicador.bonusMeta}
                              onChange={e => setFormIndicador({ ...formIndicador, bonusMeta: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="bonusSupermeta">Bônus Supermeta</Label>
                            <Input
                              id="bonusSupermeta"
                              type="number"
                              value={formIndicador.bonusSupermeta}
                              onChange={e => setFormIndicador({ ...formIndicador, bonusSupermeta: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="colaborador">Colaborador</Label>
                          <Select value={formIndicador.colaboradorId} onValueChange={v => setFormIndicador({ ...formIndicador, colaboradorId: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um colaborador" />
                            </SelectTrigger>
                            <SelectContent>
                              {colaboradores.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setDialogIndicadorOpen(false); resetFormIndicador(); }}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveIndicador}>
                          {indicadorEditando ? 'Atualizar' : 'Criar'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="h-[500px]">
                    <div className="min-w-[900px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Indicador</TableHead>
                            <TableHead className="min-w-[180px]">Colaborador</TableHead>
                            <TableHead className="min-w-[120px]">Departamento</TableHead>
                            <TableHead className="min-w-[80px]">Medida</TableHead>
                            <TableHead className="text-right min-w-[100px]">Bônus Meta</TableHead>
                            <TableHead className="text-right min-w-[110px]">Bônus Supermeta</TableHead>
                            <TableHead className="text-center min-w-[250px] pr-4">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {indicadores.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                Nenhum indicador encontrado. Importe dados do Excel ou crie manualmente.
                              </TableCell>
                            </TableRow>
                          ) : (
                            indicadores.map(ind => (
                              <TableRow key={ind.id}>
                                <TableCell className="font-medium max-w-[200px] truncate" title={ind.nome}>{ind.nome}</TableCell>
                                <TableCell className="max-w-[180px] truncate" title={ind.colaborador.nome}>{ind.colaborador.nome}</TableCell>
                                <TableCell>{ind.colaborador.setor.departamento.nome}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{ind.medida}</Badge>
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(ind.bonusMeta)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(ind.bonusSupermeta)}</TableCell>
                                <TableCell className="pr-4">
                                  <div className="flex justify-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openColetaDialog(ind)} className="text-xs">
                                      <TrendingUp className="h-3 w-3 mr-1" />
                                      Coleta
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => openMetaDialog(ind)} className="text-xs">
                                      <Target className="h-3 w-3 mr-1" />
                                      Meta
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => openHistoricoDialog(ind)} title="Ver histórico">
                                      <History className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => openEditIndicador(ind)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteIndicador(ind.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>

            {/* Dialog de Coleta */}
            <Dialog open={dialogColetaOpen} onOpenChange={setDialogColetaOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Coleta</DialogTitle>
                  <DialogDescription>
                    Indicador: {indicadorColeta?.nome}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Período</Label>
                    <Input
                      type="month"
                      value={formColeta.periodo}
                      onChange={e => setFormColeta({ ...formColeta, periodo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Valor Realizado</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formColeta.valor}
                      onChange={e => setFormColeta({ ...formColeta, valor: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Comentário (opcional)</Label>
                    <Textarea
                      value={formColeta.comentario}
                      onChange={e => setFormColeta({ ...formColeta, comentario: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogColetaOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveColeta}>
                    Registrar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog de Meta */}
            <Dialog open={dialogMetaOpen} onOpenChange={setDialogMetaOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Definir Meta</DialogTitle>
                  <DialogDescription>
                    Indicador: {indicadorMeta?.nome}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Período</Label>
                    <Input
                      type="month"
                      value={formMeta.periodo}
                      onChange={e => setFormMeta({ ...formMeta, periodo: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Meta</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formMeta.meta}
                        onChange={e => setFormMeta({ ...formMeta, meta: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Supermeta</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formMeta.supermeta}
                        onChange={e => setFormMeta({ ...formMeta, supermeta: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Informações da Alteração (opcional)</p>
                    
                    <div>
                      <Label>Motivo da Alteração</Label>
                      <Input
                        placeholder="Ex: Ajuste sazonal, revisão trimestral..."
                        value={formMeta.motivo}
                        onChange={e => setFormMeta({ ...formMeta, motivo: e.target.value })}
                      />
                    </div>
                    
                    <div>
                      <Label>Observações</Label>
                      <Textarea
                        placeholder="Detalhes adicionais sobre a alteração..."
                        value={formMeta.observacao}
                        onChange={e => setFormMeta({ ...formMeta, observacao: e.target.value })}
                        rows={2}
                      />
                    </div>
                    
                    <div>
                      <Label>Responsável</Label>
                      <Input
                        placeholder="Nome de quem está alterando"
                        value={formMeta.usuario}
                        onChange={e => setFormMeta({ ...formMeta, usuario: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogMetaOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveMeta}>
                    Salvar Meta
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog de Histórico */}
            <Dialog open={dialogHistoricoOpen} onOpenChange={setDialogHistoricoOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Histórico de Alterações</DialogTitle>
                  <DialogDescription>
                    Indicador: {indicadorMeta?.nome} | Período: {periodoSelecionado}
                  </DialogDescription>
                </DialogHeader>
                
                {loadingHistorico ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : historicoMeta.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhum histórico de alteração encontrado.</p>
                    <p className="text-sm">As alterações aparecerão aqui quando a meta for modificada.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {historicoMeta.map((h, index) => (
                        <Card key={h.id} className={index === 0 ? "border-primary" : ""}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={index === 0 ? "default" : "secondary"}>
                                  Versão {h.versaoNova}
                                </Badge>
                                {index === 0 && <Badge variant="outline">Atual</Badge>}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(h.dataAlteracao).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Meta</p>
                                <p className="font-medium">
                                  <span className="text-red-500">{h.metaAnterior.toLocaleString('pt-BR')}</span>
                                  {' → '}
                                  <span className="text-green-500">{h.metaNova.toLocaleString('pt-BR')}</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Supermeta</p>
                                <p className="font-medium">
                                  <span className="text-red-500">{h.supermetaAnterior.toLocaleString('pt-BR')}</span>
                                  {' → '}
                                  <span className="text-green-500">{h.supermetaNova.toLocaleString('pt-BR')}</span>
                                </p>
                              </div>
                            </div>
                            
                            {(h.motivo || h.observacao || h.usuario) && (
                              <div className="mt-3 pt-3 border-t text-sm">
                                {h.motivo && (
                                  <p><span className="text-muted-foreground">Motivo:</span> {h.motivo}</p>
                                )}
                                {h.observacao && (
                                  <p><span className="text-muted-foreground">Obs:</span> {h.observacao}</p>
                                )}
                                {h.usuario && (
                                  <p><span className="text-muted-foreground">Por:</span> {h.usuario}</p>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogHistoricoOpen(false)}>
                    Fechar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Relatório de Metas e Super Metas
                    </CardTitle>
                    <CardDescription>
                      Período: {new Date(periodoSelecionado + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                  >
                    {downloadingPdf ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {downloadingPdf ? 'Gerando PDF...' : 'Gerar PDF de Pagamentos'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filtros */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar colaborador..."
                        value={searchColaborador}
                        onChange={e => setSearchColaborador(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={filterDepartamento} onValueChange={setFilterDepartamento}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_todos">Todos</SelectItem>
                      {departamentos.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterSetor} onValueChange={setFilterSetor}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Setor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_todos">Todos</SelectItem>
                      {setoresFiltrados.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="h-[500px]">
                    <div className="min-w-[800px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="min-w-[200px]">
                              <span className="font-semibold">Colaborador</span>
                            </TableHead>
                            <TableHead className="min-w-[200px]">
                              <span className="font-semibold">Indicador</span>
                            </TableHead>
                            <TableHead className="text-center min-w-[120px]">
                              <span className="font-semibold text-blue-600">Meta</span>
                            </TableHead>
                            <TableHead className="text-center min-w-[120px]">
                              <span className="font-semibold text-green-600">Super Meta</span>
                            </TableHead>
                            <TableHead className="text-right min-w-[100px]">Realizado</TableHead>
                            <TableHead className="text-center min-w-[110px]">Status</TableHead>
                            <TableHead className="text-right min-w-[100px] pr-4">Bônus</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {indicadoresFiltrados.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                Sem dados de performance para exibir
                              </TableCell>
                            </TableRow>
                          ) : (
                            indicadoresFiltrados.map(ind => {
                              const meta = ind.metas?.find(m => m.periodo === periodoSelecionado)
                              const coleta = ind.coletas?.find(c => c.periodo === periodoSelecionado)
                              
                              return (
                                <TableRow key={ind.id}>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{ind.colaborador.nome}</span>
                                      <span className="text-xs text-muted-foreground">{ind.colaborador.funcao}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={ind.nome}>
                                    <span className="text-sm">{ind.nome}</span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-blue-700 font-medium">
                                      {meta ? meta.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-green-700 font-medium">
                                      {meta ? meta.supermeta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {coleta ? coleta.valor.toLocaleString('pt-BR') : '-'}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {coleta ? (
                                      coleta.atingiuSupermeta ? (
                                        <Badge className="bg-green-600 text-xs">Supermeta</Badge>
                                      ) : coleta.atingiuMeta ? (
                                        <Badge className="bg-blue-600 text-xs">Meta</Badge>
                                      ) : (
                                        <Badge variant="destructive" className="text-xs">Não atingida</Badge>
                                      )
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">Sem coleta</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium pr-4">
                                    {coleta ? formatCurrency(coleta.bonusCalculado) : '-'}
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fontes de Dados Tab */}
          <TabsContent value="fontes">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Fontes de Dados
                    </CardTitle>
                    <CardDescription>
                      Configure integrações com sistemas externos para buscar valores das coletas
                    </CardDescription>
                  </div>
                  <Dialog open={dialogFonteDadosOpen} onOpenChange={(open) => { setDialogFonteDadosOpen(open); if (!open) resetFormFonteDados(); }}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Fonte
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{fonteEditando ? 'Editar' : 'Nova'} Fonte de Dados</DialogTitle>
                        <DialogDescription>
                          Configure a integração com o sistema externo
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Nome *</Label>
                            <Input
                              value={formFonteDados.nome}
                              onChange={e => setFormFonteDados({ ...formFonteDados, nome: e.target.value })}
                              placeholder="Ex: API ERP Financeiro"
                            />
                          </div>
                          <div>
                            <Label>Indicador Vinculado</Label>
                            <Select value={formFonteDados.indicadorId} onValueChange={v => setFormFonteDados({ ...formFonteDados, indicadorId: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {indicadores.map(ind => (
                                  <SelectItem key={ind.id} value={ind.id}>
                                    {ind.nome} ({ind.colaborador.nome})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label>Descrição</Label>
                          <Input
                            value={formFonteDados.descricao}
                            onChange={e => setFormFonteDados({ ...formFonteDados, descricao: e.target.value })}
                            placeholder="Descrição opcional..."
                          />
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          <div className="col-span-3">
                            <Label>URL *</Label>
                            <Input
                              value={formFonteDados.url}
                              onChange={e => setFormFonteDados({ ...formFonteDados, url: e.target.value })}
                              placeholder="https://api.exemplo.com/dados"
                            />
                          </div>
                          <div>
                            <Label>Método</Label>
                            <Select value={formFonteDados.metodo} onValueChange={v => setFormFonteDados({ ...formFonteDados, metodo: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                                <SelectItem value="PUT">PUT</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Variáveis disponíveis: {'{periodo}'}, {'{mes}'}, {'{ano}'}
                        </p>

                        <Separator />

                        <div>
                          <Label>Tipo de Autenticação</Label>
                          <Select value={formFonteDados.tipoAutenticacao} onValueChange={v => setFormFonteDados({ ...formFonteDados, tipoAutenticacao: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Nenhuma">Nenhuma</SelectItem>
                              <SelectItem value="Bearer">Bearer Token</SelectItem>
                              <SelectItem value="Basic">Basic Auth</SelectItem>
                              <SelectItem value="ApiKey">API Key</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {formFonteDados.tipoAutenticacao !== 'Nenhuma' && (
                          <div className="grid grid-cols-2 gap-4">
                            {formFonteDados.tipoAutenticacao === 'ApiKey' && (
                              <div>
                                <Label>Nome do Header</Label>
                                <Input
                                  value={formFonteDados.headerAuthName}
                                  onChange={e => setFormFonteDados({ ...formFonteDados, headerAuthName: e.target.value })}
                                  placeholder="X-API-Key"
                                />
                              </div>
                            )}
                            <div>
                              <Label>{formFonteDados.tipoAutenticacao === 'ApiKey' ? 'Valor da Chave' : 'Token'}</Label>
                              <Input
                                type="password"
                                value={formFonteDados.tokenAutenticacao}
                                onChange={e => setFormFonteDados({ ...formFonteDados, tokenAutenticacao: e.target.value })}
                                placeholder="••••••••"
                              />
                            </div>
                          </div>
                        )}

                        <Separator />

                        <div>
                          <Label>Headers Customizados (JSON)</Label>
                          <Textarea
                            value={formFonteDados.headers}
                            onChange={e => setFormFonteDados({ ...formFonteDados, headers: e.target.value })}
                            placeholder='{"X-Custom-Header": "valor"}'
                            rows={2}
                          />
                        </div>

                        {formFonteDados.metodo !== 'GET' && (
                          <div>
                            <Label>Body (JSON)</Label>
                            <Textarea
                              value={formFonteDados.body}
                              onChange={e => setFormFonteDados({ ...formFonteDados, body: e.target.value })}
                              placeholder='{"periodo": "{periodo}"}'
                              rows={3}
                            />
                          </div>
                        )}

                        <Separator />

                        <div>
                          <Label>Campo do Valor na Resposta</Label>
                          <Input
                            value={formFonteDados.campoValor}
                            onChange={e => setFormFonteDados({ ...formFonteDados, campoValor: e.target.value })}
                            placeholder="valor ou data.valor"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Use notação de ponto para objetos aninhados (ex: data.resultado.valor)
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setDialogFonteDadosOpen(false); resetFormFonteDados(); }}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveFonteDados}>
                          {fonteEditando ? 'Atualizar' : 'Criar'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="min-w-[180px]">Nome</TableHead>
                          <TableHead className="min-w-[200px]">URL</TableHead>
                          <TableHead className="min-w-[150px]">Indicador</TableHead>
                          <TableHead className="text-center min-w-[100px]">Autenticação</TableHead>
                          <TableHead className="text-center min-w-[100px]">Status</TableHead>
                          <TableHead className="text-center min-w-[180px]">Última Sync</TableHead>
                          <TableHead className="text-center min-w-[200px] pr-4">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fontesDados.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              Nenhuma fonte de dados cadastrada. Clique em "Nova Fonte" para começar.
                            </TableCell>
                          </TableRow>
                        ) : (
                          fontesDados.map(fonte => (
                            <TableRow key={fonte.id}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">{fonte.nome}</span>
                                  <span className="text-xs text-muted-foreground">{fonte.descricao}</span>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                <span className="text-xs truncate block" title={fonte.url}>{fonte.url}</span>
                              </TableCell>
                              <TableCell>
                                {fonte.indicador ? (
                                  <span className="text-sm">{fonte.indicador.nome}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Não vinculado</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-xs">
                                  {fonte.tipoAutenticacao}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {fonte.statusUltimaSync === 'Sucesso' ? (
                                  <Badge className="bg-green-600 text-xs">OK</Badge>
                                ) : fonte.statusUltimaSync === 'Erro' ? (
                                  <Badge variant="destructive" className="text-xs">Erro</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Pendente</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col">
                                  <span className="text-xs">
                                    {fonte.ultimaSincronizacao
                                      ? new Date(fonte.ultimaSincronizacao).toLocaleString('pt-BR')
                                      : '-'}
                                  </span>
                                  {fonte.mensagemErro && (
                                    <span className="text-xs text-red-500 truncate" title={fonte.mensagemErro}>
                                      {fonte.mensagemErro}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="pr-4">
                                <div className="flex justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTestFonteDados(fonte)}
                                    disabled={testingFonte === fonte.id}
                                    title="Testar conexão"
                                  >
                                    {testingFonte === fonte.id ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Play className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSyncFonteDados(fonte, false)}
                                    disabled={syncingFonte === fonte.id || !fonte.indicadorId}
                                    title="Sincronizar período selecionado"
                                  >
                                    {syncingFonte === fonte.id ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Zap className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSyncFonteDados(fonte, true)}
                                    disabled={syncingFonte === fonte.id || !fonte.indicadorId}
                                    title="Sincronizar todos os períodos (API retorna array)"
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => openEditFonteDados(fonte)} title="Editar">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteFonteDados(fonte.id)} title="Excluir">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>

            {/* Dialog de Resultado do Teste */}
            <Dialog open={dialogTestResultOpen} onOpenChange={setDialogTestResultOpen}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Resultado do Teste</DialogTitle>
                </DialogHeader>
                {testResult && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="font-medium">
                        {testResult.success ? 'Conexão bem sucedida!' : 'Falha na conexão'}
                      </span>
                    </div>

                    {testResult.status && (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Status HTTP:</span>
                          <Badge variant={testResult.success ? 'default' : 'destructive'} className="ml-2">
                            {testResult.status}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tempo:</span>
                          <span className="ml-2">{testResult.responseTime}ms</span>
                        </div>
                        {testResult.valorExtraido !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Valor:</span>
                            <span className="ml-2 font-medium">{String(testResult.valorExtraido)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {testResult.error && (
                      <div className="p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                        {testResult.error}
                      </div>
                    )}

                    {testResult.data && (
                      <div>
                        <Label>Resposta da API:</Label>
                        <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-60">
                          {JSON.stringify(testResult.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={() => setDialogTestResultOpen(false)}>Fechar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>Sistema de Gestão de Meritocracia</span>
            <span>{colaboradores.length} colaboradores • {indicadores.length} indicadores • {fontesDados.length} fontes</span>
          </div>
        </div>
      </footer>

      <Toaster />
    </div>
  )
}
