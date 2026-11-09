import { useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ISODate } from '../core'
import { leggiImpostazioni, tuttiIClienti } from '../core'
import { Agenda } from './agenda/Agenda'
import { Clienti } from './clienti/Clienti'
import { ImpostazioniSchermata } from './impostazioni/Impostazioni'
import { Layout } from './layout/Layout'
import type { VoceNav } from './layout/Sidebar'
import { DaPagare } from './debiti/DaPagare'
import { Promemoria } from './promemoria/Promemoria'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Benvenuto } from './components/Benvenuto'
import { Caricamento } from './components/Caricamento'
import { Toast, type ToastAzione } from './components/Toast'
import './styles/global.css'

export default function App() {
  const [voce, setVoce] = useState<VoceNav>('agenda')
  const [toast, setToast] = useState<ToastAzione | null>(null)
  const [skipBenvenuto, setSkipBenvenuto] = useState(false)
  const [agendaDataIniziale, setAgendaDataIniziale] = useState<ISODate | null>(null)

  const imp = useLiveQuery(() => leggiImpostazioni(), [])
  const clienti = useLiveQuery(() => tuttiIClienti(), [])

  const onToast = useCallback((t: ToastAzione) => setToast(t), [])
  const fineToast = useCallback(() => setToast(null), [])
  const onBenvenutoPronto = useCallback((dataAgenda: ISODate) => {
    setAgendaDataIniziale(dataAgenda)
    setSkipBenvenuto(true)
    setVoce('agenda')
  }, [])

  const naviga = useCallback((v: VoceNav) => {
    setSkipBenvenuto(true)
    setVoce(v)
  }, [])

  const logoUrl = imp?.logo ? `${import.meta.env.BASE_URL}${imp.logo}` : ''

  if (!imp || clienti === undefined) {
    return (
      <>
        <Caricamento />
        <Toast azione={toast} onFine={fineToast} />
      </>
    )
  }

  const mostraBenvenuto = clienti.length === 0 && !imp.demoAttiva && !skipBenvenuto

  return (
    <>
      <Layout voce={voce} onNaviga={naviga}>
        <ErrorBoundary>
          {voce === 'agenda' ? (
            <Agenda onToast={onToast} dataIniziale={agendaDataIniziale} />
          ) : null}
          {voce === 'promemoria' ? <Promemoria onToast={onToast} /> : null}
          {voce === 'clienti' ? <Clienti /> : null}
          {voce === 'debiti' ? <DaPagare onToast={onToast} /> : null}
          {voce === 'impostazioni' ? <ImpostazioniSchermata /> : null}
        </ErrorBoundary>
        {mostraBenvenuto ? (
          <Benvenuto imp={imp} logoUrl={logoUrl} onPronto={onBenvenutoPronto} />
        ) : null}
      </Layout>
      <Toast azione={toast} onFine={fineToast} />
    </>
  )
}
