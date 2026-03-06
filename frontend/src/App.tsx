import { useState } from 'react'
import Items from './Items'
import Dashboard from './Dashboard'

function App() {
  const [currentPage, setCurrentPage] = useState<'items' | 'dashboard'>('items')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Навигация */}
      <nav className="bg-white shadow mb-4">
        <div className="container mx-auto px-4 py-3">
          <button
            onClick={() => setCurrentPage('items')}
            className={`mr-4 px-4 py-2 rounded ${
              currentPage === 'items' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Items
          </button>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className={`px-4 py-2 rounded ${
              currentPage === 'dashboard' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Dashboard
          </button>
        </div>
      </nav>

      {/* Контент */}
      {currentPage === 'items' ? <Items /> : <Dashboard />}
    </div>
  )
}

export default App