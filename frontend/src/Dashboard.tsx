import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
)

// Types for API responses
interface ScoreBucket {
  bucket: string
  count: number
}

interface PassRateItem {
  task: string
  avg_score: number
  attempts: number
}

interface TimelineEntry {
  date: string
  submissions: number
}

interface LabOption {
  id: string
  title: string
}

// Chart data types
interface BarChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor: string[]
    borderColor: string[]
    borderWidth: number
  }[]
}

interface LineChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    borderColor: string
    backgroundColor: string
    tension: number
    fill: boolean
  }[]
}

const API_KEY_STORAGE = 'api_key'
const DEFAULT_LAB = 'lab-04'

function Dashboard() {
  const [selectedLab, setSelectedLab] = useState<string>(DEFAULT_LAB)
  const [labs, setLabs] = useState<LabOption[]>([])
  const [scores, setScores] = useState<ScoreBucket[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [passRates, setPassRates] = useState<PassRateItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch labs list on mount
  useEffect(() => {
    const token = localStorage.getItem(API_KEY_STORAGE)
    if (!token) {
      setError('API key not found. Please set your API key.')
      return
    }

    // Fetch items to populate lab dropdown
    fetch('/items/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((items: { id: number; type: string; title: string }[]) => {
        const labItems = items
          .filter((item) => item.type === 'lab')
          .map((item) => ({
            id: item.title.toLowerCase().replace(' ', '-'),
            title: item.title,
          }))
        setLabs(labItems)
      })
      .catch((err: Error) => {
        setError(`Failed to load labs: ${err.message}`)
      })
  }, [])

  // Fetch analytics data when lab changes
  useEffect(() => {
    const token = localStorage.getItem(API_KEY_STORAGE)
    if (!token) {
      setError('API key not found')
      return
    }

    setLoading(true)
    setError(null)

    const fetchAnalytics = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` }

        // Fetch all three endpoints in parallel
        const [scoresRes, timelineRes, passRatesRes] = await Promise.all([
          fetch(`/analytics/scores?lab=${selectedLab}`, { headers }),
          fetch(`/analytics/timeline?lab=${selectedLab}`, { headers }),
          fetch(`/analytics/pass-rates?lab=${selectedLab}`, { headers }),
        ])

        if (!scoresRes.ok) throw new Error(`Scores: HTTP ${scoresRes.status}`)
        if (!timelineRes.ok)
          throw new Error(`Timeline: HTTP ${timelineRes.status}`)
        if (!passRatesRes.ok)
          throw new Error(`Pass rates: HTTP ${passRatesRes.status}`)

        const scoresData: ScoreBucket[] = await scoresRes.json()
        const timelineData: TimelineEntry[] = await timelineRes.json()
        const passRatesData: PassRateItem[] = await passRatesRes.json()

        setScores(scoresData)
        setTimeline(timelineData)
        setPassRates(passRatesData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [selectedLab])

  // Prepare bar chart data for score distribution
  const barChartData: BarChartData = {
    labels: scores.map((s) => s.bucket),
    datasets: [
      {
        label: 'Number of Students',
        data: scores.map((s) => s.count),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(54, 162, 235, 0.6)',
        ],
        borderColor: [
          'rgb(255, 99, 132)',
          'rgb(255, 159, 64)',
          'rgb(75, 192, 192)',
          'rgb(54, 162, 235)',
        ],
        borderWidth: 1,
      },
    ],
  }

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Score Distribution',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  }

  // Prepare line chart data for timeline
  const lineChartData: LineChartData = {
    labels: timeline.map((t) => t.date),
    datasets: [
      {
        label: 'Submissions',
        data: timeline.map((t) => t.submissions),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.3,
        fill: true,
      },
    ],
  }

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
      },
      title: {
        display: true,
        text: 'Submissions Over Time',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  }

  if (error) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <p className="error">{error}</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Analytics Dashboard</h1>
        <div className="lab-selector">
          <label htmlFor="lab-select">Select Lab: </label>
          <select
            id="lab-select"
            value={selectedLab}
            onChange={(e) => setSelectedLab(e.target.value)}
          >
            {labs.length > 0 ? (
              labs.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.title}
                </option>
              ))
            ) : (
              <option value={DEFAULT_LAB}>Lab 04</option>
            )}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="loading">Loading analytics...</div>
      ) : (
        <div className="dashboard-content">
          {/* Score Distribution Bar Chart */}
          <div className="chart-container">
            <Bar data={barChartData} options={barChartOptions} />
          </div>

          {/* Timeline Line Chart */}
          <div className="chart-container">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>

          {/* Pass Rates Table */}
          <div className="table-container">
            <h2>Pass Rates by Task</h2>
            {passRates.length > 0 ? (
              <table className="pass-rates-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Avg Score</th>
                    <th>Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {passRates.map((item) => (
                    <tr key={item.task}>
                      <td>{item.task}</td>
                      <td>{item.avg_score.toFixed(1)}</td>
                      <td>{item.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No pass rate data available</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
