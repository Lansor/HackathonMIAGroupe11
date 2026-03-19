import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type Plugin,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js'
import { useEffect, useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import UsersTable from '../components/UsersTable/UsersTable'


ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const whiteBackgroundPlugin: Plugin<'bar'> = {
  id: 'whiteBackground',
  beforeDraw: (chart) => {
    const { ctx, width, height } = chart
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  },
}

function Dashboard() {
  type ApiUser = {
    id: string
    username: string
    email: string
    role: 'user' | 'admin'
    createdAt: string
  }

  type ApiCuratedData = {
    _id: string
    user_id?: string
    filename?: string
    doc_type: 'facture' | 'devis' | 'urssaf' | 'kbis' | 'rib'
    compliance?: {
      is_valid?: boolean
      status?: string
      message?: string
      errors?: string[]
    }
    status?: string
    alerts?: Array<{ message?: string }>
    createdAt: string
  }

  const [users, setUsers] = useState<ApiUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [curatedData, setCuratedData] = useState<ApiCuratedData[]>([])
  const [curatedLoading, setCuratedLoading] = useState(true)
  const [curatedError, setCuratedError] = useState<string | null>(null)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setUsersLoading(true)
        setUsersError(null)

        const response = await fetch('/api/user-manager', {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Impossible de recuperer les utilisateurs.')
        }

        const data = (await response.json()) as { users?: ApiUser[] }
        setUsers(Array.isArray(data.users) ? data.users : [])
      } catch (error) {
        setUsersError(
          error instanceof Error
            ? error.message
            : 'Erreur lors du chargement des utilisateurs.',
        )
      } finally {
        setUsersLoading(false)
      }
    }

    void loadUsers()
  }, [])

  useEffect(() => {
    const loadCuratedData = async () => {
      try {
        setCuratedLoading(true)
        setCuratedError(null)

        const response = await fetch('/api/document/curated/all', {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Impossible de recuperer les donnees curatees.')
        }

        const data = (await response.json()) as {
          curatedData?: ApiCuratedData[]
        }

        setCuratedData(Array.isArray(data.curatedData) ? data.curatedData : [])
      } catch (error) {
        setCuratedError(
          error instanceof Error
            ? error.message
            : 'Erreur lors du chargement des donnees curatees.',
        )
      } finally {
        setCuratedLoading(false)
      }
    }

    void loadCuratedData()
  }, [])

  const nonAdminUsers = useMemo(
    () =>
      users
        .filter((user) => user.role !== 'admin')
        .map((user) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: new Date(user.createdAt),
          anomalies: [],
        })),
    [users],
  )

  const anomaliesByUser = useMemo(() => {
    const map = new Map<
      string,
      Array<{ filename: string; docType: string; status: string; message: string }>
    >()

    for (const item of curatedData) {
      const userId = item.user_id ? String(item.user_id) : ''
      if (!userId) continue

      const status =
        item.compliance?.status ??
        item.status ??
        (item.compliance?.is_valid === false ? 'ANOMALIE' : '')
      const normalizedStatus = status.toUpperCase()

      const message =
        item.compliance?.message ??
        item.compliance?.errors?.[0] ??
        item.alerts?.[0]?.message ??
        ''

      const hasAnomaly =
        item.compliance?.is_valid === false ||
        (Boolean(status) &&
          !['VALIDATED', 'CURATED', 'UPDATED'].includes(normalizedStatus)) ||
        Boolean(message)

      if (!hasAnomaly) continue

      const current = map.get(userId) ?? []
      current.push({
        filename: item.filename || 'Fichier inconnu',
        docType: item.doc_type,
        status: status || 'ANOMALIE',
        message: message || 'Anomalie detectee',
      })
      map.set(userId, current)
    }

    return map
  }, [curatedData])

  const usersWithAnomalies = useMemo(
    () =>
      nonAdminUsers.map((user) => ({
        ...user,
        anomalies: anomaliesByUser.get(user.id) ?? [],
      })),
    [anomaliesByUser, nonAdminUsers],
  )

  const listeFichiers = useMemo(() => {
    const counters = {
      facture: 0,
      devis: 0,
      urssaf: 0,
      kbis: 0,
      rib: 0,
    }

    for (const item of curatedData) {
      counters[item.doc_type] += 1
    }

    return [
      { nom: 'facture', nb: counters.facture },
      { nom: 'devis', nb: counters.devis },
      { nom: 'urssaf', nb: counters.urssaf },
      { nom: 'kbis', nb: counters.kbis },
      { nom: 'rib', nb: counters.rib },
    ]
  }, [curatedData])

  const listeTypeFichier = useMemo(() => {
    const conformes = curatedData.filter((item) => item.compliance?.is_valid).length
    const nonConformes = curatedData.length - conformes

    return [
      { nom: 'conformes', nb: conformes },
      { nom: 'non conformes', nb: nonConformes },
    ]
  }, [curatedData])


  const chartData = {
    labels: listeFichiers.map((fichier) => fichier.nom),
    datasets: [
      {
        label: 'Nombre de fichiers',
        data: listeFichiers.map((fichier) => fichier.nb),
        backgroundColor: 'rgba(79, 70, 229, 0.7)',
        borderColor: 'rgb(79, 70, 229)',
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  }

  const chartDataTypeFichier = {
    labels: listeTypeFichier.map((fichier) => fichier.nom),
    datasets: [
      {
        label: 'Nombre de fichiers',
        data: listeTypeFichier.map((fichier) => fichier.nb),
        backgroundColor: 'rgba(14, 165, 233, 0.7)',
        borderColor: 'rgb(14, 165, 233)',
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Nombre par categorie',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  }
  return (
    <main className="min-h-screen bg-slate-100 px-6 pt-6 pb-16 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
             
            </div>
          </div>
        </header>

        <section
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '1.5rem' }}
        >
          <div
            className="w-full"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              gap: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            <div className="mx-auto rounded-xl bg-white p-2" style={{ width: '20rem', height: '20rem', backgroundColor: '#ffffff' }}>
              <Bar
                data={chartData}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: 'Nombre par categorie' } } }}
                style={{ width: '100%', height: '100%' }}
                plugins={[whiteBackgroundPlugin]}
              />
            </div>

            <div className="mx-auto rounded-xl bg-white p-2" style={{ width: '20rem', height: '20rem', backgroundColor: '#ffffff' }}>
              <Bar
                data={chartDataTypeFichier}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: 'Conformite des documents' } } }}
                style={{ width: '100%', height: '100%' }}
                plugins={[whiteBackgroundPlugin]}
              />
            </div>
          </div>
        </section>



        <div className="mt-8 space-y-3" style={{ marginTop: '2rem' }}>
          {curatedLoading ? (
            <p className="text-sm text-slate-500">Chargement des donnees curatees...</p>
          ) : null}
          {curatedError ? (
            <p className="text-sm text-red-600">{curatedError}</p>
          ) : null}
          {usersLoading ? (
            <p className="text-sm text-slate-500">Chargement des utilisateurs...</p>
          ) : null}
          {usersError ? (
            <p className="text-sm text-red-600">{usersError}</p>
          ) : null}
          {!usersLoading && !usersError ? <UsersTable users={usersWithAnomalies} /> : null}
        </div>

      </div>
    </main>
  )
}

export default Dashboard
