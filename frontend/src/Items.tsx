import { useEffect, useState } from 'react'

interface Item {
  id: string
  lab: string
  task: string | null
  title: string
  type: 'lab' | 'task'
}

export default function Items() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchItems = async () => {
      const token = localStorage.getItem('api_key')
      
      try {
        const response = await fetch('/items/', {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch items')
        }
        
        const data = await response.json()
        setItems(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Items</h1>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Lab</th>
            <th className="border p-2">Task</th>
            <th className="border p-2">Title</th>
            <th className="border p-2">Type</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="border p-2">{item.lab}</td>
              <td className="border p-2">{item.task || '-'}</td>
              <td className="border p-2">{item.title}</td>
              <td className="border p-2">{item.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}