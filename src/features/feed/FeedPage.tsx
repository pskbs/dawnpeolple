import { CONCEPT_COPY, FEED_NATIONWIDE_NOTICE } from '../../config/copy'

export function FeedPage() {
  return (
    <section>
      <h1>수다방</h1>
      <p>{CONCEPT_COPY.primary}</p>
      <p>{FEED_NATIONWIDE_NOTICE}</p>
      <p>(피드는 Phase 1에서 구현돼요)</p>
    </section>
  )
}
