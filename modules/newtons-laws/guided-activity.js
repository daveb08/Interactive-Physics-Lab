import { EXPERIMENTS, GuidedSession, comparisonRows, resultRow } from './guided-experiments.js';

const $ = id => document.getElementById(id);
const signed = value => `${value > 0 ? '+' : ''}${value}`;
const paragraph = (heading, body) => {
  const section = document.createElement('section');
  const title = document.createElement('h3');
  title.textContent = heading;
  const text = document.createElement('p');
  text.textContent = body;
  section.append(title, text);
  return section;
};

export class GuidedActivity {
  constructor(onReset, onPrediction, onNext) {
    this.onReset = onReset;
    this.onPrediction = onPrediction;
    const groups = {};
    for (const name of ['Newton’s Second Law','Friction']) { const group = document.createElement('optgroup'); group.label = name; $('guided-select').append(group); groups[name] = group; }
    for (const [id, experiment] of Object.entries(EXPERIMENTS).sort(([a], [b]) => a.localeCompare(b))) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${id} — ${experiment.title}`;
      groups[experiment.group || 'Newton’s Second Law'].append(option);
    }
    $('guided-select').addEventListener('change', () => onReset());
    $('guided-choices').addEventListener('change', () => {
      if (this.session.started) return;
      this.session.prediction = null;
      $('guided-prediction-status').textContent = 'Save your updated prediction before starting.';
      onPrediction(null);
    });
    $('next-run').addEventListener('click', () => {
      if (!this.session.nextRun()) return;
      $('next-run').hidden = true;
      $('guided-step').textContent = `Previous runs recorded. Start Run ${this.session.runIndex+1} with the same saved prediction.`;
      onNext(this.session.run);
    });
    $('guided-prediction-form').addEventListener('submit', event => {
      event.preventDefault();
      const choice = new FormData(event.currentTarget).get('guided-prediction');
      if (this.session.savePrediction(choice)) {
        $('guided-prediction-status').textContent = 'Prediction saved. Start the experiment to test it.';
        onPrediction(choice);
      }
    });
    $('reflection-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!this.session.completed) return;
      if (!$('reflection-answer').value.trim()) {
        $('reflection-answer').setCustomValidity('Write a brief explanation before viewing the model answer.');
        $('reflection-answer').reportValidity();
        return;
      }
      $('model-answer').textContent = this.session.experiment.modelAnswer;
      $('model-answer-panel').hidden = false;
      $('reflection-status').textContent = 'Explanation submitted. Compare your reasoning with the instructor-authored model answer. Your response is not graded.';
    });
    $('reflection-answer').addEventListener('input', () => $('reflection-answer').setCustomValidity(''));
  }
  reset() {
    this.session = new GuidedSession($('guided-select').value);
    const e = this.session.experiment;
    $('guided-title').textContent = e.title;
    // Use an inquiry objective before the run so the objective itself does not give away the answer.
    $('guided-objective').textContent = e.previewObjective;
    $('guided-conditions').textContent = e.runs.map((r, i) => `${e.runs.length > 1 ? `Run ${i + 1}: ` : ''}mass ${r.mass} kg · ${r.frictionEnabled ? 'applied' : 'net'} force ${signed(r.force)} N · initial velocity ${signed(r.velocity)} m/s${r.frictionEnabled ? ` · μs ${r.muS.toFixed(2)} · μk ${r.muK.toFixed(2)}` : ''}`).join(' | ');
    $('guided-question').textContent = e.question;
    $('guided-choices').replaceChildren();
    e.options.forEach((text, i) => {
      const letter = 'ABCD'[i];
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'guided-prediction'; input.value = letter; input.required = true;
      label.append(input, document.createTextNode(`${letter}. ${text}`));
      $('guided-choices').append(label);
    });
    $('guided-prediction-fields').disabled = false;
    $('guided-save').disabled = false;
    $('guided-prediction-status').textContent = 'Save your prediction before starting.';
    $('guided-feedback').hidden = true;
    $('guided-results').hidden = true;
    $('comparison-table-panel').hidden = true;
    $('comparison-table-body').replaceChildren();
    $('next-run').hidden = true;
    $('reflection-panel').hidden = true;
    $('reflection-form').reset();
    $('reflection-answer').setCustomValidity('');
    $('reflection-status').textContent = '';
    $('model-answer-panel').hidden = true;
    $('model-answer').textContent = '';
    $('guided-step').textContent = e.runs.length > 1 ? `Predict → complete ${e.runs.length} trials in order → compare → explain. Each observation ends at ${e.observationTime} s.` : '1. Predict · 2. Run · 3. Explain';
    return this.session.run;
  }
  start() {
    if (!this.session.start()) return false;
    $('guided-prediction-fields').disabled = true;
    $('guided-save').disabled = true;
    $('guided-step').textContent = 'Observe the motion and graphs. Feedback follows the completed run.';
    return true;
  }
  complete() {
    if (!this.session.completeRun()) return;
    this.showResults();
    if (this.session.completed) this.showFeedback();
    else {
      $('next-run').hidden = false;
      const number = this.session.runIndex+1;
      $('start').textContent = `Run ${number} complete`;
      $('run-status').textContent = `Run ${number} complete`;
      $('next-run').textContent = `Prepare Run ${number+1}`;
      $('guided-step').textContent = `Run ${number} recorded. Prepare and start Run ${number+1}.`;
    }
  }
  showResults() {
    const r = this.session.run;
    $('guided-results').hidden = false;
    $('guided-result-text').textContent = `At t = ${r.state.t.toFixed(2)} s: position ${r.state.x.toFixed(2)} m; velocity ${signed(r.state.v.toFixed(2))} m/s; acceleration ${signed(r.a.toFixed(2))} m/s².`;
    if (r.frictionEnabled) $('guided-result-text').textContent += ` ${r.events.map(e => `${e.label} at ${e.t.toFixed(3)} s.`).join(' ')}`;
    const e = this.session.experiment;
    if (e.runs.length > 1) {
      $('guided-result-text').textContent = this.session.completed ? `All ${e.runs.length} runs observed at t = ${e.observationTime.toFixed(2)} s. Compare one changed variable while holding the others constant.` : `${this.session.results.length} of ${e.runs.length} runs observed at t = ${e.observationTime.toFixed(2)} s. Measurements are retained below.`;
      $('comparison-table-panel').hidden = false;
      const rows = this.session.completed ? comparisonRows(this.session.results, e.observationTime) : this.session.results.map(resultRow);
      const head = document.querySelector('#comparison-table-panel thead tr'); head.replaceChildren();
      for (const label of ['Measurement',...e.runs.map((_,i) => `Run ${i+1}`)]) { const th = document.createElement('th'); th.scope='col'; th.textContent=label; head.append(th); }
      document.querySelector('#comparison-table-panel caption').textContent = `Controlled comparison · common observation time: ${e.observationTime} s`;
      document.querySelector('#comparison-table-panel .help').textContent = `Velocity curves share axes: Run 1 solid blue, Run 2 dashed orange${e.runs.length > 2 ? ', Run 3 dotted purple' : ''}. ${this.session.id === 'F3' ? 'The two curves coincide: identical deceleration and stopping time. Initial friction and acceleration below describe sliding, before stopping.' : ''}`;
      $('comparison-table-body').replaceChildren();
      const fields = [['Mass', 'mass', 'kg'], [r.frictionEnabled ? 'Applied force' : 'Net force', 'force', 'N'], ['Initial velocity', 'velocity', 'm/s']];
      if (r.frictionEnabled) fields.push(['Normal force','normal','N'],['Max. static friction','maxStatic','N'],['Initial friction force','initialFriction','N'],['Initial acceleration','initialAcceleration','m/s²'],['Friction at 3 s','finalFriction','N'],['Net force at 3 s','netForce','N']);
      fields.push([r.frictionEnabled ? 'Acceleration at 3 s' : 'Acceleration', 'acceleration', 'm/s²'], ['Velocity at 3 s', 'finalVelocity', 'm/s'], ['Position at 3 s', 'position', 'm']);
      for (const [label, key, unit] of fields) {
        const tr = document.createElement('tr');
        const th = document.createElement('th'); th.scope = 'row'; th.textContent = `${label} (${unit})`; tr.append(th);
        for (let i = 0; i < e.runs.length; i++) { const td = document.createElement('td'); td.textContent = rows[i] ? rows[i][key].toFixed(r.frictionEnabled ? 3 : 2) : 'Not observed'; tr.append(td); }
        $('comparison-table-body').append(tr);
      }
    }
  }
  showFeedback() {
    const e = this.session.experiment;
    $('guided-objective').textContent = e.objective;
    $('guided-feedback').hidden = false;
    $('guided-feedback').replaceChildren(
      paragraph('Observation', e.observation),
      paragraph('Physics explanation', e.explanation),
      paragraph('Key takeaway', e.takeaway),
      paragraph('Your prediction', this.session.prediction === e.answer
        ? 'Your prediction matches the observation.'
        : e.misconceptions[this.session.prediction]),
    );
    $('guided-step').textContent = 'Experiment complete. Use the evidence to explain your reasoning.';
    $('reflection-question').textContent = e.reflection;
    $('reflection-panel').hidden = false;
  }
}
