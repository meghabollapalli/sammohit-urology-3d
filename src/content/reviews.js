/**
 * Patient reviews shown in the carousel.
 *
 * Source: the clinic's public Google listing, read on 22 November 2026. The text
 * is copied word for word (spelling included); only the reviewer's name is
 * shortened to one name. Every review on the listing had five stars.
 *
 * To switch to a live feed later, replace this array at build time with the
 * result of a Google Places "reviews" request mapped to the same shape:
 *   { name: string, stars: 1-5, text: string }
 * Nothing else in the site needs to change.
 */
export const reviews = [
  {
    name: 'Ravikiran',
    stars: 5,
    text: 'Very very patience person and attentive doctor who takes the time to clarify all doubts and explain everything clearly. I recently consulted this doctor for a right-sided kidney stone. He carefully evaluated and treated my condition and also guided me on the necessary lifestyle changes to prevent future problems.\nOverall, I had a very good experience. He is professional, caring, and approachable. I would definitely recommend him as a good urologist. 10/10!'
  },
  {
    name: 'Anantha',
    stars: 5,
    text: 'Best urology centre in guntur. Recently Dr Sammohit removed my left kidney stone with laser at prabhavathi multispeciality hospital and discharged me on the same day. My surgery went smooth, completely painless. I was able to see the stone getting powdered with laser during my surgery. Hospital is tidy and clean. Staff are very supportive. Very much satisfied. Special mention to feroz, manager. He is very much responsive . Overall a pleasant experience. Thank you Dr sammohit'
  },
  {
    name: 'Akhila',
    stars: 5,
    text: 'I highly recommend Dr. Sammohit. He explained all the details very clearly and took great care of patient'
  },
  {
    name: 'Sarath',
    stars: 5,
    text: 'I consulted Dr Sammohit for my staghorn stone problem, sir did surgery and cleared stone completely.  Best urologist in Guntur'
  },
  {
    name: 'Sai',
    stars: 5,
    text: 'Excellent hospital for urology problem, Dr.G  SVS Sammohit sir was so friendly Nature to understand our problem, hospital roooms and ambiance is good'
  },
  {
    name: 'Sreelakshmi',
    stars: 5,
    text: 'Dr sammohit did Dj stenting at very affordable price for my mother. Best urologist. Best hospital. Thank you Sir'
  },
  {
    name: 'Venkateswarlu',
    stars: 5,
    text: 'Best Urologist in Guntur. Sir did URSL for me for affordable price. Same day discharge. Thank you sir'
  }
];
