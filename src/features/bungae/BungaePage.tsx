import { CONCEPT_COPY, REGION_NOTICE } from '../../config/copy'

export function BungaePage() {
  return (
    <section>
      <h1>벙개모임</h1>
      <p>{CONCEPT_COPY.bungaeIntro}</p>
      <p>{REGION_NOTICE}</p>
      <p>(목록/개설은 Phase 1에서 구현돼요)</p>
    </section>
  )
}
