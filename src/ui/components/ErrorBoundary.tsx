import { Component, type ErrorInfo, type ReactNode } from 'react'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
}

interface State {
  errore: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { errore: null }

  static getDerivedStateFromError(errore: Error): State {
    return { errore }
  }

  componentDidCatch(errore: Error, info: ErrorInfo) {
    console.error(errore, info.componentStack)
  }

  render() {
    if (this.state.errore) {
      return (
        <div className="errore-schermata" role="alert">
          <p className="errore-schermata-titolo">Qualcosa non ha funzionato</p>
          <p className="errore-schermata-msg">{this.state.errore.message}</p>
          <button type="button" className="errore-schermata-ricarica" onClick={() => location.reload()}>
            Ricarica
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
