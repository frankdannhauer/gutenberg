/**
 * Internal dependencies
 */
import placeCaretAtEdge from './place-caret-at-edge';

/**
 * Places the caret at the top or bottom of a given element.
 *
 * @param {Element} container Focusable element.
 * @param {boolean} isReverse True for bottom, false for top.
 * @param {DOMRect} [rect]    The rectangle to position the caret with.
 */
export default function placeCaretAtVerticalEdge( container, isReverse, rect ) {
	return placeCaretAtEdge( { container, isReverse, x: rect.left } );
}
