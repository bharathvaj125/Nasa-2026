export interface Twist { id: string; title: string; text: string; effect: string }

/** Unexpected constraints Mission Control can throw at a design (real programmes face all of these). */
export const TWISTS: Twist[] = [
  { id: 'budget-cut', title: 'Budget review', text: 'A funding review trims the programme.', effect: 'Budget cap reduced by 12%.' },
  { id: 'solar-max', title: 'Solar maximum', text: 'The Sun is far more active than forecast.', effect: 'Solar activity is 1.8× higher: more drag and more radiation storms.' },
  { id: 'capacity-cut', title: 'Rocket reassigned', text: 'A heavier primary payload takes your slot, so your rocket gives you less margin.', effect: 'Launch capacity reduced by 15%.' },
  { id: 'extended-life', title: 'Extended mission requested', text: 'The agency asks for a longer science mission.', effect: 'Operations must run at least 12 months beyond the original plan.' },
  { id: 'late-supplier', title: 'Supplier delay', text: 'A key supplier delivers late.', effect: 'Development takes 9 months longer, which may cost you the launch window.' },
];
export const getTwist = (id?: string) => TWISTS.find((t) => t.id === id);
