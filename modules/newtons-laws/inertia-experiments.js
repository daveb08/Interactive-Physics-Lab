export const INERTIA_EXPERIMENTS = {
  I1: {
    group: 'Newton’s First Law', title: 'An object at rest',
    previewObjective: 'Investigate what happens to a stationary object when net external force is zero.',
    objective: 'Understand that remaining at rest is a special case of constant velocity under zero net external force.',
    runs: [{mass:2,force:0,velocity:0,frictionEnabled:false}], observationTime:6,
    conditions: 'Mass 2 kg · initial velocity 0 m/s · net force 0 N · friction disabled · observe for 6 s.',
    question: 'The cart is initially at rest on a frictionless track with zero net force. Will it move?',
    options: ['It starts moving right.', 'It remains at rest.', 'It starts moving left.', 'It accelerates because friction is absent.'], answer:'B',
    observation: 'Position remained 0 m, velocity remained 0 m/s, and acceleration remained 0 m/s² for all 6 seconds.',
    explanation: 'Zero net external force means zero acceleration. Acceleration is a change in velocity; without it, the initial velocity of zero stays zero. Removing friction does not supply a force.',
    takeaway: 'An object at rest remains at rest when its net external force is zero.',
    misconceptions: {A:'A rightward change in velocity requires a rightward net force; none acts here.', C:'A leftward change in velocity requires a leftward net force; none acts here.', D:'The absence of friction does not cause acceleration. A nonzero net force is needed to change velocity.'},
    reflection:'Why does a cart at rest remain at rest when there is no net external force?',
    modelAnswer:'Zero net force gives zero acceleration, so velocity cannot change. Since its initial velocity is zero, it remains zero and position stays constant.'
  },
  I2: {
    group: 'Newton’s First Law', title: 'An object in motion',
    previewObjective:'Investigate whether an already moving object needs a continuing net force.',
    objective:'Understand that zero net external force preserves a moving object’s velocity.',
    runs:[{mass:2,force:0,velocity:3,frictionEnabled:false}], observationTime:6,
    conditions:'Mass 2 kg · initial velocity +3 m/s · net force 0 N · friction disabled · observe for 6 s.',
    question:'The cart moves right at +3 m/s with zero net force and no friction. How will its velocity change?',
    options:['It gradually decreases to zero.', 'It remains constant at +3 m/s.', 'It continuously increases.', 'It immediately becomes zero.'],answer:'B',
    observation:'The cart moved 3 meters each second and reached x = 18 m at 6 s. Velocity stayed +3 m/s and acceleration stayed zero.',
    explanation:'Force changes velocity through acceleration; it does not maintain velocity. With zero net external force, acceleration is zero. The velocity graph is horizontal and the position graph has constant slope +3 m/s.',
    takeaway:'A moving object continues at constant velocity when net external force is zero.',
    misconceptions:{A:'Slowing requires acceleration opposite motion. No friction or other opposing net force acts here.',C:'Increasing velocity requires positive acceleration and a nonzero net force.',D:'Zero force means zero acceleration, not zero velocity. Motion does not disappear when force is absent.'},
    reflection:'How can a cart move to the right while both its net force and acceleration are zero?',
    modelAnswer:'Velocity describes motion, while acceleration describes changes in velocity. With zero net force the acceleration is zero, so the cart keeps its initial +3 m/s velocity.'
  },
  I3: {
    group:'Newton’s First Law', title:'What happens when the force disappears?',
    previewObjective:'Investigate how motion changes when an applied force is removed.',
    objective:'Distinguish force, acceleration, and velocity: removing net force stops acceleration, not motion.',
    runs:[{mass:2,force:4,velocity:0,frictionEnabled:false,removeForceAt:2}], observationTime:6,
    conditions:'Mass 2 kg · initial velocity 0 m/s · applied/net force +4 N for 0 ≤ t < 2 s, then 0 N automatically · friction disabled · observe for 6 s.',
    question:'After the +4 N force is removed at t = 2 s, what happens to the moving cart?',
    options:['It immediately stops.', 'It keeps the velocity reached at 2 s, with zero acceleration.', 'It continues accelerating at the same rate.', 'It gradually slows to rest.'],answer:'B',
    observation:'For the first 2 s, acceleration was +2 m/s². At removal, x = 4 m and v = +4 m/s. Then acceleration became zero, velocity stayed +4 m/s, and position reached 20 m at 6 s.',
    explanation:'Force is an interaction that changes motion; net force determines acceleration through a = Fnet/m. Velocity describes current motion. Removing force at 2 s changes acceleration from +2 to 0 m/s² without an impulse, so position and velocity are continuous. The position curve becomes a straight line and the velocity curve becomes horizontal.',
    takeaway:'Removing the net force removes acceleration; the velocity already acquired remains.',
    misconceptions:{A:'An immediate stop would require an impulse. Removing the force does not reset velocity.',C:'The cart does not store acceleration: with zero net force, acceleration becomes zero.',D:'Slowing requires an opposing net force. There is no friction or other opposing force after removal.'},
    reflection:'Why does acceleration become zero at force removal while velocity remains +4 m/s?',
    modelAnswer:'During the first 2 s, a = 4/2 = 2 m/s² and v = 0 + 2×2 = 4 m/s. Removing force makes acceleration zero, not velocity. With no impulse or friction, velocity remains +4 m/s and x = 4 + 4(t−2) afterward.'
  }
};
