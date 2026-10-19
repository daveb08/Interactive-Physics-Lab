/** Instructor-authored guided activities for C1 Uniform circular motion. Pure data + checks (unit-tested). */
export const ACTIVITIES = Object.freeze({
  U1: {
    title: 'The string breaks',
    settings: { mass: 0.5, radius: 1.5, speed: 3 },
    cut: { angle: 0, afterRevolutions: 1 },
    conditions: 'Top view. A 0.5 kg puck on a frictionless table circles counterclockwise at 3 m/s on a 1.5 m string. After one full turn the string is cut when the puck is at the 3 o’clock point.',
    objective: 'Predict the path of an object the moment nothing pulls it toward the centre any more.',
    fullObjective: 'With the string cut, the net force is zero, so by Newton’s first law the puck keeps the velocity it had at that instant: a straight line along the tangent.',
    question: 'At 3 o’clock the puck is moving up the page. After the string is cut, the puck moves…',
    choices: [
      { id: 'A', text: 'In a straight line up the page, along the direction it was moving' },
      { id: 'B', text: 'In a straight line to the right, directly away from the centre' },
      { id: 'C', text: 'Outward along a curve, spiralling away from the centre' },
      { id: 'D', text: 'Around the circle a little longer, then off in a curve' },
    ],
    correct: 'A',
    misconceptions: {
      B: 'Nothing pushes the puck outward. The “outward pull” you feel on a turning ride is your body tending to keep going straight. With no force, the puck keeps its velocity, which at 3 o’clock points up the page.',
      C: 'A curved path needs a sideways force. Once the string is cut there is no horizontal force at all, so the path is straight.',
      D: 'An object has no memory of its circle. The instant the string goes slack, the inward force is gone and the path stops curving.',
    },
    observation: 'The puck leaves along the tangent at 3 m/s, straight up the page. The force graph drops to zero at the cut, and the velocity components stop changing.',
    explanation: 'While attached, the string supplies the net force m v²/r toward the centre, which only turns the velocity. At the cut that force vanishes: a = 0, so v stays constant in size and direction (Newton’s first law).',
    takeaway: 'Circular motion needs an inward net force. Remove it and the object goes straight, tangent to the circle; there is no outward “centrifugal” force on it.',
    reflection: 'A hammer thrower lets go of the hammer. Explain where it goes and why, using the idea of the tangent.',
    modelAnswer: 'At release the hammer’s velocity is tangent to the circle it was moving on, and the only horizontal force on it (the pull through the wire) disappears. With no horizontal net force it continues in a straight line along that tangent (then gravity curves it downward). The thrower times the release so the tangent points down the field.',
  },
  U2: {
    title: 'Hammer throw: double the speed',
    settings: { mass: 4, radius: 1.5, speed: 5 },
    reference: { settings: { mass: 4, radius: 1.5, speed: 2.5 }, label: '2.5 m/s' },
    conditions: 'Top view of a 4 kg hammer swung on a 1.5 m circle (a training throw). First run at 2.5 m/s is shown as a ghost; your run is at 5 m/s.',
    objective: 'Predict how the inward pull changes when the speed doubles.',
    fullObjective: 'The centripetal force F = m v²/r grows with the square of the speed: doubling v multiplies it by 4.',
    question: 'At 5 m/s instead of 2.5 m/s, the inward pull the thrower must supply is…',
    choices: [
      { id: 'A', text: 'The same', value: 1 },
      { id: 'B', text: 'Twice as large', value: 2 },
      { id: 'C', text: 'Four times as large', value: 4 },
      { id: 'D', text: 'Half as large', value: 0.5 },
    ],
    correct: 'C',
    ratio: s => s.speed ** 2 / 2.5 ** 2,
    misconceptions: {
      A: 'Same radius is not the same force. Faster motion turns the velocity more sharply each second, which needs a larger inward force.',
      B: 'Doubling v doubles how big the velocity is and doubles how fast it turns, so the change of velocity per second grows by 2 × 2 = 4: F = m v²/r.',
      D: 'A faster hammer needs more inward pull, not less. That is why fast throws are so demanding on the thrower’s arms and grip.',
    },
    observation: 'The force graph reads 66.7 N at 5 m/s against 16.7 N at 2.5 m/s, a factor of 4. The period halves from 3.77 s to 1.88 s.',
    explanation: 'a = v²/r: the velocity has twice the size and turns through the circle in half the time, so its rate of change is four times larger. F = m a = m v²/r follows from Newton’s second law.',
    takeaway: 'Centripetal force scales as v²: small increases in speed demand large increases in grip, friction or tension.',
    reflection: 'Why do elite hammer throwers lean back and use their whole body rather than just their arms?',
    modelAnswer: 'At competition speeds (around 25 m/s) the inward force m v²/r is thousands of newtons, far more than the arms alone can supply. Leaning back lets the thrower’s weight and legs provide the inward pull on the hammer (and keep the thrower balanced against the equal and opposite pull of the hammer on them).',
  },
  U3: {
    title: 'A wider circle at the same speed',
    settings: { mass: 0.5, radius: 1.5, speed: 3 },
    reference: { settings: { mass: 0.5, radius: 0.75, speed: 3 }, label: 'r = 0.75 m' },
    conditions: 'Same puck (0.5 kg) at the same speed, 3 m/s. A tight 0.75 m circle is shown as a ghost; your run uses a 1.5 m circle.',
    objective: 'Predict how the inward force depends on the radius when the speed is fixed.',
    fullObjective: 'At fixed speed F = m v²/r, so doubling the radius halves the force: a wider turn is gentler.',
    question: 'Compared with the 0.75 m circle, the string tension on the 1.5 m circle is…',
    choices: [
      { id: 'A', text: 'Twice as large', value: 2 },
      { id: 'B', text: 'Half as large', value: 0.5 },
      { id: 'C', text: 'The same', value: 1 },
      { id: 'D', text: 'Four times as large', value: 4 },
    ],
    correct: 'B',
    ratio: s => 0.75 / s.radius,
    misconceptions: {
      A: 'A bigger circle at the same speed is a gentler turn: the velocity changes direction more slowly, so less force is needed (F = m v²/r).',
      C: 'The speed is the same, but the turning rate is not. On the wider circle the puck takes twice as long to go round, so its velocity changes half as fast.',
      D: 'Force does not grow with the radius at fixed speed; it falls as 1/r.',
    },
    observation: 'The tension reads 3.0 N on the 1.5 m circle and 6.0 N on the 0.75 m circle. The wider circle takes twice as long per lap.',
    explanation: 'With v fixed, a = v²/r: doubling r halves the acceleration and so halves F = m a.',
    takeaway: 'At a given speed, tighter turns need more inward force. This is why roads and running tracks use wide curves, and why a sharp turn at speed can make tyres or shoes slip.',
    reflection: 'A runner rounds the bend of a track in lane 1 and in lane 8 at the same speed. In which lane must friction from the track supply more force, and why?',
    modelAnswer: 'Lane 1 has the smaller radius. At the same speed, the needed inward (centripetal) force is m v²/r, which is larger for smaller r. That force comes from static friction between shoes and track, so lane 1 demands more friction.',
  },
  U4: {
    title: 'Merry-go-round: same period, wider circle',
    settings: { mass: 0.5, radius: 1.5, speed: 3 },
    reference: { settings: { mass: 0.5, radius: 0.75, speed: 1.5 }, label: 'r = 0.75 m, same period' },
    conditions: 'Two equal 0.5 kg pucks go round together, like riders on a merry-go-round: both take π ≈ 3.14 s per lap. The inner one (ghost) is at 0.75 m; yours is at 1.5 m.',
    objective: 'Predict the force on the outer rider when both share the same period.',
    fullObjective: 'On a rotating platform both riders have the same ω. Then F = m ω² r: doubling r doubles the force (the outer rider also moves twice as fast).',
    question: 'Compared with the inner rider at 0.75 m, the inward force needed on the outer rider at 1.5 m is…',
    choices: [
      { id: 'A', text: 'Half as large', value: 0.5 },
      { id: 'B', text: 'The same', value: 1 },
      { id: 'C', text: 'Twice as large', value: 2 },
      { id: 'D', text: 'Four times as large', value: 4 },
    ],
    correct: 'C',
    ratio: s => s.radius / 0.75,
    misconceptions: {
      A: 'That would be true at the same speed (activity U3). Here the outer rider must also move twice as fast to keep up, which matters more: F = m v²/r = m ω² r.',
      B: 'Same period does not mean same speed. The outer rider covers twice the distance per lap, so moves at twice the speed.',
      D: 'Speed doubles (×4 in v²), but the radius also doubles (÷2), so the force doubles overall.',
    },
    observation: 'Both pucks complete a lap in 3.14 s. The outer one moves at 3 m/s (inner 1.5 m/s), and its tension is 3.0 N against 1.5 N.',
    explanation: 'With a shared angular speed ω = 2 rad/s, v = ω r and a = v²/r = ω² r. Doubling r doubles both v and a.',
    takeaway: 'Whether force goes up or down with radius depends on what is held fixed: at fixed speed F ∝ 1/r, at fixed period F ∝ r.',
    reflection: 'Compare this result with U3. Why do the two activities give opposite answers about the effect of radius?',
    modelAnswer: 'In U3 the speed was fixed, so a wider circle meant a slower turning rate and a = v²/r fell. In U4 the period (ω) was fixed, so the outer puck had to move faster; with a = ω² r the force grows with radius. The formula F = m v²/r is the same, but which other quantity is held constant changes the dependence on r.',
  },
});
export const ACTIVITY_IDS = Object.keys(ACTIVITIES);

export function activityFeedback(id, choice) {
  const a = ACTIVITIES[id];
  if (!a) throw new RangeError(`Unknown activity ${id}`);
  if (choice === a.correct) return { correct: true, message: 'That matches the experiment.' };
  return { correct: false, message: a.misconceptions[choice] || 'Compare your prediction with the experiment.' };
}
