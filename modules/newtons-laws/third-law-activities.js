import { createSpringRun, SPRING_DEFAULTS } from '../../js/core/spring-physics.js';
export const THIRD_EXPERIMENTS = {
 T1: {title:'Equal masses',settings:{...SPRING_DEFAULTS},
 objective:'Compare the directions and magnitudes of the accelerations of two equal masses during spring release.',
 question:'Two 2 kg carts start at rest. How do their accelerations compare while the spring pushes them apart?',
 options:['Cart A has greater acceleration magnitude.','They have equal magnitudes and opposite directions.','Both accelerate in the same direction.','Neither accelerates because the forces cancel.'],answer:'B',
 observation:'During contact, the two forces and accelerations have equal magnitudes and opposite signs. Both carts then coast with equal speeds in opposite directions.',
 explanation:'The interaction force on A points left and the interaction force on B points right. Since both masses are 2 kg, a = F/m gives equal acceleration magnitudes. The forces act on different carts, so each cart accelerates even though their sum for the whole system is zero.',
 reflection:'Why can both carts accelerate when the total external horizontal force on the system is zero?',
 model:'Each cart has a nonzero force during contact. The two internal forces act on different carts and sum to zero for the combined system, preserving total momentum, not each individual velocity.'},
 T2: {title:'Unequal masses',settings:{...SPRING_DEFAULTS,massB:4},
 objective:'Distinguish the interaction force from the acceleration it produces when masses differ.',
 question:'Cart A is 2 kg and Cart B is 4 kg. Which statement describes their interaction?',
 options:['The heavier cart exerts twice the force.','The forces are equal and opposite; Cart A has twice the acceleration magnitude.','Equal forces mean equal accelerations.','The lighter cart exerts twice the force.'],answer:'B',
 observation:'At every instant of contact, the two forces have equal magnitudes. The 2 kg cart’s acceleration magnitude is twice that of the 4 kg cart. After separation both forces and accelerations are zero.',
 explanation:'Newton’s Third Law fixes the force relationship, F on A = −F on B. Newton’s Second Law then gives aA = F on A / 2 and aB = F on B / 4. A larger mass responds with less acceleration, not with a different interaction-force magnitude.',
 reflection:'Why does the lighter cart accelerate more even though the force magnitudes are equal?',
 model:'The two forces are equal and opposite, but a = F/m. With half the mass, Cart A has twice the acceleration magnitude. Their momenta remain equal and opposite.'},
 T3: {title:'Identify the force pair',settings:{...SPRING_DEFAULTS},
 objective:'Use separate free-body diagrams to identify which object receives each interaction force.',
 question:'Which two horizontal forces form the action–reaction pair in this ideal two-cart spring coupling?',
 options:['The leftward force on A and rightward force on B.','The weight and normal force on Cart A.','Two equal horizontal forces both acting on Cart A.','The force on A and the acceleration of B.'],answer:'A',
 observation:'The leftward interaction arrow belongs to Cart A’s diagram. The rightward interaction arrow belongs to Cart B’s diagram. Their lengths match throughout contact and both vanish at separation.',
 explanation:'An action–reaction pair acts on two different objects. The forces cannot cancel in one cart’s free-body diagram. Weight and normal force balance vertically but are not a Third Law pair: both act on the same cart. Acceleration is a response to force, not another force.',
 reflection:'Why should the interaction forces be drawn on two separate free-body diagrams?',
 model:'Each diagram contains only forces acting on that cart. The pair consists of B’s leftward force on A and A’s rightward force on B, transmitted by the ideal massless spring. They act on different bodies.'}
};
export class ThirdLawSession {
 constructor(mode='guided',id='T1',settings=SPRING_DEFAULTS){
  if(!['guided','free'].includes(mode)||!THIRD_EXPERIMENTS[id])throw new RangeError('Unknown activity.');
  this.mode=mode;this.id=id;this.experiment=THIRD_EXPERIMENTS[id];this.prediction=null;this.started=false;
  this.run=createSpringRun(mode==='guided'?this.experiment.settings:settings);
 }
 savePrediction(choice){if(this.started||!['A','B','C','D'].includes(choice))return false;this.prediction=choice;return true;}
 start(){if(this.run.done||(this.mode==='guided'&&!this.prediction))return false;this.started=true;return true;}
}
