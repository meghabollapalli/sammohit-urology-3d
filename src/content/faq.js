/**
 * Patient FAQ. Rendered into the page and into FAQPage structured data at
 * build time, so the visible answers and the schema never drift apart.
 * Plain text only (no HTML): answers are escaped when rendered.
 */
export const faqs = [
  {
    q: 'When is kidney stone pain an emergency?',
    a: 'Go to the nearest emergency department straight away if stone pain comes with fever or shivering, vomiting that stops you keeping fluids down, passing very little or no urine, or if you have only one working kidney or are pregnant. These can mean a blocked, infected kidney, which needs urgent treatment.'
  },
  {
    q: 'Will a small kidney stone pass on its own?',
    a: 'Many stones smaller than about 5 mm pass by themselves within a few weeks, often helped by medicine that relaxes the ureter. Larger stones, stones that stop moving, and stones causing infection or a blocked kidney usually need treatment. The doctor decides based on the stone’s size, position and your symptoms.'
  },
  {
    q: 'Do RIRS and URSL leave a cut or stitches?',
    a: 'No. Both use a thin telescope passed through the natural urinary passage, so there is no cut on the skin. They are done under anaesthesia, and sometimes a thin soft tube called a stent is left in for a short time and removed later.'
  },
  {
    q: 'How is PCNL different?',
    a: 'PCNL is used for large stones, usually over 2 cm, or stones that fill much of the kidney. The stone is removed through a small keyhole in the back. Mini-PCNL uses an even smaller opening.'
  },
  {
    q: 'What is the difference between HoLEP and TURP?',
    a: 'Both treat an enlarged prostate from the inside, through the urinary passage, with no cut on the skin. TURP removes the blocking tissue in small pieces with an electric loop. HoLEP uses a laser to remove the enlarged part and is suitable for small and very large prostates. The doctor recommends one based on prostate size, your health and the medicines you take.'
  },
  {
    q: 'Is a men’s sexual health consultation confidential?',
    a: 'Yes. Consultations are private and one to one, and you can book using only your initials. Your partner is welcome to join if you wish.'
  },
  {
    q: 'Are erectile dysfunction and premature ejaculation treatable?',
    a: 'Both are common and usually treatable. Erectile problems are often linked to diabetes, blood pressure, heart health, hormones or stress, and can be an early sign of heart disease, so a proper check-up matters. Treatment is planned around the cause.'
  },
  {
    q: 'What should I bring to my first visit?',
    a: 'Bring any scan reports and images (ultrasound, CT), recent blood and urine test results, old prescriptions or discharge summaries, and a list of the medicines you take, especially blood thinners.'
  },
  {
    q: 'Can kidney stones come back?',
    a: 'Yes, stones often come back. Drinking enough water through the day, some changes to diet and, where useful, testing the removed stone to find out what it is made of all help lower the chance of new stones.'
  }
];

export default faqs;
