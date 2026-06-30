function StepIcon({ status }) {
  if (status === 'done') {
    return <span className="qv-progress-icon qv-progress-icon--done" aria-hidden="true">✓</span>;
  }
  if (status === 'active') {
    return <span className="qv-progress-icon qv-progress-icon--active" aria-hidden="true" />;
  }
  return <span className="qv-progress-icon qv-progress-icon--pending" aria-hidden="true" />;
}

function QuiltVisionProgress({ steps, activeStepId, title, reassurance }) {
  const activeIndex = steps.findIndex((step) => step.id === activeStepId);

  return (
    <section className="qv-progress abby-patch__panel" aria-live="polite" aria-busy="true">
      <h2 className="qv-progress-title">{title}</h2>
      {reassurance && <p className="qv-progress-reassurance">{reassurance}</p>}
      <ol className="qv-progress-list">
        {steps.map((step, index) => {
          let status = 'pending';
          if (activeIndex >= 0 && index < activeIndex) {
            status = 'done';
          } else if (step.id === activeStepId) {
            status = 'active';
          }

          return (
            <li
              key={step.id}
              className={`qv-progress-item qv-progress-item--${status}`}
              aria-current={status === 'active' ? 'step' : undefined}
            >
              <StepIcon status={status} />
              <div className="qv-progress-text">
                <span className="qv-progress-label">{step.label}</span>
                {status === 'active' && step.hint && (
                  <span className="qv-progress-hint">{step.hint}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default QuiltVisionProgress;
