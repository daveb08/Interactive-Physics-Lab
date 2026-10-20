/**
 * Charging by friction, contact (conduction) and induction, as step-by-step states. Pure data (unit-tested).
 * Charge is counted in "units": each + or − symbol stands for a large number of elementary charges (~10⁹ e).
 * Only electrons move. Positive charges (nuclei) stay fixed in every object.
 * sign = −1: plastic rod rubbed with wool (rod gains electrons, ends negative).
 * sign = +1: glass rod rubbed with silk (rod loses electrons, ends positive).
 */
export const ROD_UNITS = 3;     // excess on a freshly rubbed rod
const NUC = { knob: 2, left: 2, right: 2 };  // fixed positive units in the electroscope

const scope = (knob, left, right) => ({ knob, left, right });   // electron counts by region
const net = s => (NUC.knob - s.knob) + (NUC.left - s.left) + (NUC.right - s.right);
export const regionNet = (s, region) => NUC[region] - s[region];
export const leafNet = s => regionNet(s, 'left') + regionNet(s, 'right');

const word = q => (q > 0 ? 'positive' : q < 0 ? 'negative' : 'neutral');

function finish(steps, method, sign) {
  return steps.map(st => {
    const rod = st.rod.excess, other = st.other?.excess ?? 0, sc = st.scope ? net(st.scope) : 0;
    return { ...st, method, sign, net: { rod, scope: sc, other, total: rod + sc + other } };
  });
}

export function chargingSteps(method, sign = -1) {
  if (sign !== 1 && sign !== -1) throw new RangeError('sign must be +1 or −1');
  const s = sign, R = ROD_UNITS * s;
  const rodName = s < 0 ? 'plastic rod' : 'glass rod', clothName = s < 0 ? 'wool' : 'silk';

  if (method === 'friction') return finish([
    { label: 'Before rubbing', rod: { pos: 'rub-apart', excess: 0, pairs: 4 }, other: { kind: 'cloth', excess: 0, pairs: 4 },
      caption: `The ${rodName} and the ${clothName} are both neutral: each has equal amounts of + and − charge.` },
    { label: 'Rub them together', rod: { pos: 'rub', excess: R, pairs: 4 }, other: { kind: 'cloth', excess: -R, pairs: 4 },
      caption: s < 0
        ? `Rubbing moves ${ROD_UNITS} units of electrons from the wool onto the plastic. Nothing is created: the rod is now −${ROD_UNITS}, the wool +${ROD_UNITS}.`
        : `Rubbing moves ${ROD_UNITS} units of electrons from the glass onto the silk. Nothing is created: the rod is now +${ROD_UNITS}, the silk −${ROD_UNITS}.` },
    { label: 'Pull them apart', rod: { pos: 'rub-apart', excess: R, pairs: 4 }, other: { kind: 'cloth', excess: -R, pairs: 4 },
      caption: `Separated, the rod and the ${clothName} keep equal and opposite charges. The total is still zero: charge is conserved.` },
  ], method, sign);

  if (method === 'contact') {
    const moved = 2;   // electron units that flow on contact
    const touched = s < 0 ? scope(2, 3, 3) : scope(2, 1, 1);
    return finish([
      { label: 'Neutral electroscope', rod: { pos: 'away', excess: R }, scope: scope(2, 2, 2),
        caption: `The electroscope is neutral, so its leaves hang together. The rubbed ${rodName} carries ${R > 0 ? '+' : '−'}${ROD_UNITS}.` },
      { label: 'Touch the knob', rod: { pos: 'touch', excess: R - (s * moved) }, scope: touched,
        caption: s < 0
          ? `On contact, ${moved} units of electrons flow from the rod onto the metal and spread out. Both leaves are now negative and repel each other.`
          : `On contact, ${moved} units of electrons flow from the metal onto the rod. Both leaves are left positive and repel each other.` },
      { label: 'Remove the rod', rod: { pos: 'away', excess: R - (s * moved) }, scope: touched,
        predict: { question: 'What charge does the electroscope keep after the rod is removed?', choices: [['same', 'The same sign as the rod'], ['opposite', 'The opposite sign to the rod'], ['none', 'None: it returns to neutral']], correct: 'same',
          feedback: { opposite: 'Opposite charge comes from induction. In contact charging, charge flows directly from (or to) the rod, so the electroscope ends up with the same sign.', none: 'The electrons that moved stay where they went. Without a path back, the electroscope keeps its charge and the leaves stay apart.' } },
        caption: `The electroscope keeps the charge it gained: ${word(s)}, the same sign as the rod. Charging by contact gives the same sign.` },
    ], method, sign);
  }

  if (method === 'induction') {
    const polarised = s < 0 ? scope(0, 3, 3) : scope(4, 1, 1);    // electrons pushed to the leaves, or pulled to the knob
    const grounded = s < 0 ? scope(0, 2, 2) : scope(4, 2, 2);     // leaves neutral again: electrons left to, or came from, ground
    const final = s < 0 ? scope(2, 1, 1) : scope(2, 3, 3);        // remaining charge spreads over the whole electroscope
    const g = 2 * s;                                               // ground: gains electrons (−) if the rod is negative
    return finish([
      { label: 'Neutral electroscope', rod: { pos: 'away', excess: R }, scope: scope(2, 2, 2), other: { kind: 'ground', excess: 0, connected: false },
        caption: `The electroscope is neutral and its leaves hang together. The rubbed ${rodName} carries ${R > 0 ? '+' : '−'}${ROD_UNITS}; it will never touch the knob.` },
      { label: 'Bring the rod near', rod: { pos: 'near', excess: R }, scope: polarised, other: { kind: 'ground', excess: 0, connected: false },
        caption: s < 0
          ? 'The negative rod repels electrons down to the leaves. The knob is left positive, the leaves are negative and spread apart. The electroscope is still neutral overall: charge has only moved.'
          : 'The positive rod attracts electrons up to the knob. The leaves are left positive and spread apart. The electroscope is still neutral overall: charge has only moved.' },
      { label: 'Ground it (touch with a finger)', rod: { pos: 'near', excess: R }, scope: grounded, other: { kind: 'ground', excess: g, connected: true },
        caption: s < 0
          ? 'Touching the electroscope connects it to the ground. Repelled electrons escape through the wire. The leaves close; the knob stays positive, held by the rod.'
          : 'Touching the electroscope connects it to the ground. Electrons are drawn up from the ground onto the leaves. The leaves close; the knob stays negative, held by the rod.' },
      { label: 'Remove the ground', rod: { pos: 'near', excess: R }, scope: grounded, other: { kind: 'ground', excess: g, connected: false },
        caption: 'Break the ground connection first, with the rod still nearby. The charge that moved is now trapped.' },
      { label: 'Remove the rod', rod: { pos: 'away', excess: R }, scope: final, other: { kind: 'ground', excess: g, connected: false },
        predict: { question: 'When the rod is taken away, the electroscope will be…', choices: [['same', 'Charged with the same sign as the rod'], ['opposite', 'Charged with the opposite sign to the rod'], ['none', 'Neutral, because the rod never touched it']], correct: 'opposite',
          feedback: { same: 'Nothing passed from the rod to the electroscope. Its charge came from (or went to) the ground, pushed or pulled by the rod, so it is the opposite sign.', none: 'The rod never touched it, but the ground connection let charge leave or arrive while the rod was near. That charge stays when the rod is removed.' } },
        caption: `The trapped charge spreads over the electroscope and the leaves open again: ${word(-s)}, the opposite sign to the rod. The rod kept all its own charge.` },
    ], method, sign);
  }
  throw new RangeError(`Unknown charging method ${method}`);
}
