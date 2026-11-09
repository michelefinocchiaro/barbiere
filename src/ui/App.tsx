import { useCallback, useState } from 'react'
import { Agenda } from './agenda/Agenda'
import { Clienti } from './clienti/Clienti'
import { ImpostazioniSchermata } from './impostazioni/Impostazioni'
import { Layout } from './layout/Layout'
import type { VoceNav } from './layout/Sidebar'
import { Promemoria } from './promemoria/Promemoria'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toast, type ToastAzione } from './components/Toast'
import './styles/global.css'

export default function App() {
  const [voce, setVoce] = useState<VoceNav>('agenda')
  const [toast, setToast] = useState<ToastAzione | null>(null)

  const onToast = useCallback((t: ToastAzione) => setToast(t), [])
  const fineToast = useCallback(() => setToast(null), [])

  return (
    <>
      <Layout voce={voce} onNaviga={setVoce}>
        <ErrorBoundary>
          {voce === 'agenda' ? <Agenda onToast={onToast} /> : null}
          {voce === 'promemoria' ? <Promemoria onToast={onToast} /> : null}
          {voce === 'clienti' ? <Clienti /> : null}
          {voce === 'impostazioni' ? <ImpostazioniSchermata /> : null}
        </ErrorBoundary>
      </Layout>
      <Toast azione={toast} onFine={fineToast} />
    </>
  )
}
