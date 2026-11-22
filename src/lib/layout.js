/** The one width at which the page switches between the phone and the wide layout.
 *  Keep it equal to the 900px / 899px media queries in styles.css. */
export const WIDE_MIN = 900;

export const isWide = (win = window) => win.innerWidth >= WIDE_MIN;
