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
import { Bar } from 'react-chartjs-2'
import UsersTable from './Components/UsersTable/UsersTable'


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
  const listeUsers = [
    {
      username: 'carlbrgs',
      email: 'carlbrgs@gmail.com',
      password: '123456',
      createdAt: new Date(),
    },
    {
      username: 'killian',
      email: 'killian@gmail.com',
      password: '123456',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  ]

  const listeFichiers = [
    {
      nom: 'devis',
      nb: 10,
    },
    {
      nom: 'factures fournisseurs',
      nb: 20,
    },
    {
      nom: 'Attestation SIRET',
      nb: 15,
    },
    {
      nom: 'Attestation de vigilance URSSAF',
      nb: 5,
    },
    {
      nom: 'Extrait Kbis',
      nb: 7,
    },
    {
      nom: 'RIB',
      nb: 2,
    },
  ]

  const listeTypeFichier =[
    {
      nom: 'pdf',
      nb: 10,
    },
    {
      nom: 'jpg',
      nb: 20,
    },
    {
      nom: 'png',
      nb: 15,
    },
    {
      nom: 'excel',
      nb: 15,
    },
  ]
  

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
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: 'Nombre par type de fichier' } } }}
                style={{ width: '100%', height: '100%' }}
                plugins={[whiteBackgroundPlugin]}
              />
            </div>
          </div>
        </section>



        <div className="mt-8" style={{ marginTop: '2rem' }}>
          <UsersTable users={listeUsers} />
        </div>

      </div>
    </main>
  )
}

export default Dashboard
