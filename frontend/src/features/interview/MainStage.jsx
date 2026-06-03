import { useInterviewSession } from './useInterviewSession';
import TechnicalLayout from './TechnicalLayout';
import GeneralLayout from './GeneralLayout';

export default function MainStage({ role, company, mode }) {
  const session = useInterviewSession({ role });

  if (mode === 'technical' && session.isCoding) {
    return <TechnicalLayout {...session} role={role} company={company} />;
  }
  return <GeneralLayout {...session} role={role} company={company} mode={mode} />;
}