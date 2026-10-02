/** The prototype's three steps, word for word. */
const STEPS = [
  { title: 'Request', text: 'A Domain Admin raises a formal integration request for a location.' },
  {
    title: 'Link',
    text: 'The location is mapped 1:1 to its EMR twin through a shared Unique Location ID.',
  },
  {
    title: 'Elect',
    text: 'Integrated locations send sessions, charges, charts, cases and providers; EMR-only payloads are blocked.',
  },
]

/**
 * How integration works: the prototype's "1 · Request", "2 · Link", "3 · Elect"
 * as a stepper — a numbered marker per step, joined by a thin line, so the
 * three read as one path rather than three notes. Left to right from 768px,
 * top to bottom on a phone (the line then runs down beside the text). No box
 * or fill around it.
 *
 * The line is drawn by each step but the last (`after:`), from its marker
 * toward the next one.
 */
export function IntegrationSteps() {
  return (
    <ol aria-label="How integration works" className="grid max-w-5xl gap-y-5 md:grid-cols-3 md:gap-x-6">
      {STEPS.map((step, index) => (
        <li
          key={step.title}
          className={[
            'relative flex gap-3 md:flex-col md:gap-2.5',
            // The connector.
            "not-last:after:bg-rule-structural not-last:after:absolute not-last:after:content-['']",
            // Phone: down from the marker to the next one.
            'max-md:not-last:after:top-8 max-md:not-last:after:-bottom-4 max-md:not-last:after:left-[13px] max-md:not-last:after:w-px',
            // Wider: across from the marker to the next one.
            'md:not-last:after:top-[13px] md:not-last:after:-right-5 md:not-last:after:left-9 md:not-last:after:h-px',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className="bg-brand-wash text-brand-deep text-micro relative grid size-7 flex-none place-items-center rounded-full font-semibold tabular-nums"
          >
            {index + 1}
          </span>
          <span className="min-w-0 max-md:pt-1">
            <span className="text-meta text-ink block font-medium">
              <span className="sr-only">Step {index + 1}: </span>
              {step.title}
            </span>
            <span className="text-micro text-n600 mt-1 block leading-relaxed md:pr-4">{step.text}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
