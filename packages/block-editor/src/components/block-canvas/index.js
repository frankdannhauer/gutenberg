/**
 * WordPress dependencies
 */
import { useMergeRefs } from '@wordpress/compose';
import { useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import BlockList from '../block-list';
import BlockTools from '../block-tools';
import EditorStyles from '../editor-styles';
import Iframe from '../iframe';
import WritingFlow from '../writing-flow';
import { useMouseMoveTypingReset } from '../observe-typing';
import { useBlockSelectionClearer } from '../block-selection-clearer';

export function ExperimentalBlockCanvas( {
	shouldIframe = true,
	height = '300px',
	children = <BlockList />,
	styles,
	contentRef: contentRefProp,
	iframeProps,
} ) {
	const resetTypingRef = useMouseMoveTypingReset();
	const clearerRef = useBlockSelectionClearer();
	const localRef = useRef();
	const contentRef = useMergeRefs( [ contentRefProp, clearerRef, localRef ] );

	if ( ! shouldIframe ) {
		return (
			<BlockTools
				__unstableContentRef={ localRef }
				style={ { height, display: 'flex' } }
			>
				<EditorStyles
					styles={ styles }
					scope=".editor-styles-wrapper"
				/>
				<WritingFlow
					ref={ contentRef }
					className="editor-styles-wrapper"
					tabIndex={ -1 }
					style={ {
						height: '100%',
						width: '100%',
					} }
				>
					{ children }
				</WritingFlow>
			</BlockTools>
		);
	}

	return (
		<BlockTools
			__unstableContentRef={ localRef }
			style={ { height, display: 'flex' } }
		>
			<Iframe
				{ ...iframeProps }
				ref={ resetTypingRef }
				contentRef={ contentRef }
				style={ {
					width: '100%',
					height: '100%',
					...iframeProps?.style,
				} }
				name="editor-canvas"
			>
				<EditorStyles styles={ styles } />
				{ children }
			</Iframe>
		</BlockTools>
	);
}

/**
 * BlockCanvas component is a component used to display the canvas of the block editor.
 * What we call the canvas is an iframe containing the block list that you can manipulate.
 * The component is also responsible of wiring up all the necessary hooks to enable
 * the keyboard navigation across blocks in the editor and inject content styles into the iframe.
 *
 * @example
 *
 * ```jsx
 * function MyBlockEditor() {
 *   const [ blocks, updateBlocks ] = useState([]);
 *   return (
 *     <BlockEditorProvider
 *       value={ blocks }
 *       onInput={ updateBlocks }
 *       onChange={ persistBlocks }
 *      >
 *        <BlockCanvas height="400px" />
 *      </BlockEditorProvider>
 *    );
 * }
 * ```
 *
 * @param {Object}  props          Component props.
 * @param {string}  props.height   Canvas height, defaults to 300px.
 * @param {Array}   props.styles   Content styles to inject into the iframe.
 * @param {Element} props.children Content of the canvas, defaults to the BlockList component.
 * @return {Element}               Block Breadcrumb.
 */
function BlockCanvas( { children, height, styles } ) {
	return (
		<ExperimentalBlockCanvas height={ height } styles={ styles }>
			{ children }
		</ExperimentalBlockCanvas>
	);
}

export default BlockCanvas;
