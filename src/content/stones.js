/** Copy for the stone-size picker and procedure comparison (trusted, static HTML). */
export const SIZE_COPY = {
  4: '<strong>Small stone, about 4 mm.</strong> Many stones this size pass on their own within a few weeks, often helped by medicine. See a doctor if pain, fever or vomiting do not settle.',
  8: '<strong>Medium stone, about 8 mm.</strong> Less likely to pass on its own and can get stuck in the ureter. Usually treated with URSL or RIRS laser, without a cut.',
  14: '<strong>Larger kidney stone, about 14 mm.</strong> Too big to pass. RIRS is a common choice: a flexible telescope breaks it into dust from inside the kidney.',
  22: '<strong>Large stone, over 2 cm.</strong> Usually treated with PCNL or Mini-PCNL through a small keyhole in the back, which can clear a large stone in one sitting.'
};

export const MODALITY_COPY = {
  ursl: {
    text: '<strong>URSL, ureteroscopic laser lithotripsy.</strong> A thin telescope passes through the urinary passage up into the ureter, and a laser breaks the stone into tiny pieces that wash out.',
    tags: ['No skin cut', 'Stones in the ureter', 'Under anaesthesia']
  },
  rirs: {
    text: '<strong>RIRS, retrograde intrarenal surgery.</strong> A flexible telescope bends up into the kidney itself, and a laser turns the stone to fine dust that passes out with urine.',
    tags: ['No skin cut', 'Kidney stones up to about 2 cm', 'Flexible telescope']
  },
  pcnl: {
    text: '<strong>PCNL or Mini-PCNL, percutaneous nephrolithotomy.</strong> For large stones, the doctor goes straight into the kidney through a small keyhole in the back and removes the stone.',
    tags: ['One small keyhole', 'Stones over about 2 cm', 'Large stones in one sitting']
  }
};
