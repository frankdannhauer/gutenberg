/**
 * External dependencies
 */
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { AsyncModeProvider, useSelect } from '@wordpress/data';
import { useRef, createContext, useState, useMemo } from '@wordpress/element';
import { useViewportMatch, useMergeRefs } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import BlockListBlock from './block';
import BlockListAppender from '../block-list-appender';
import useBlockDropZone from '../use-block-drop-zone';
import useInsertionPoint from './insertion-point';
import BlockPopover from './block-popover';
import { store as blockEditorStore } from '../../store';
import { usePreParsePatterns } from '../../utils/pre-parse-patterns';
import { LayoutProvider, defaultLayout } from './layout';

export const BlockNodes = createContext();
export const SetBlockNodes = createContext();
export const IntersectionObserver = createContext();

export default function BlockList( { className, __experimentalLayout } ) {
	const ref = useRef();
	const [ blockNodes, setBlockNodes ] = useState( {} );
	const insertionPoint = useInsertionPoint( ref );
	usePreParsePatterns();

	const isLargeViewport = useViewportMatch( 'medium' );
	const {
		isTyping,
		isOutlineMode,
		isFocusMode,
		isNavigationMode,
	} = useSelect( ( select ) => {
		const {
			isTyping: _isTyping,
			getSettings,
			isNavigationMode: _isNavigationMode,
		} = select( blockEditorStore );
		const { outlineMode, focusMode } = getSettings();
		return {
			isTyping: _isTyping(),
			isOutlineMode: outlineMode,
			isFocusMode: focusMode,
			isNavigationMode: _isNavigationMode(),
		};
	}, [] );

	return (
		<BlockNodes.Provider value={ blockNodes }>
			{ insertionPoint }
			<BlockPopover />
			<div
				ref={ useMergeRefs( [ ref, useBlockDropZone() ] ) }
				className={ classnames(
					'block-editor-block-list__layout is-root-container',
					className,
					{
						'is-typing': isTyping,
						'is-outline-mode': isOutlineMode,
						'is-focus-mode': isFocusMode && isLargeViewport,
						'is-navigate-mode': isNavigationMode,
					}
				) }
			>
				<SetBlockNodes.Provider value={ setBlockNodes }>
					<BlockListItems
						__experimentalLayout={ __experimentalLayout }
					/>
				</SetBlockNodes.Provider>
			</div>
		</BlockNodes.Provider>
	);
}

function Items( {
	placeholder,
	rootClientId,
	renderAppender,
	__experimentalAppenderTagName,
	__experimentalLayout: layout = defaultLayout,
} ) {
	const [ intersectingBlocks, setIntersectingBlocks ] = useState( new Set() );
	const intersectionObserver = useMemo( () => {
		const { IntersectionObserver: Observer } = window;

		if ( ! Observer ) {
			return;
		}

		return new Observer( ( entries ) => {
			setIntersectingBlocks( ( oldIntersectingBlocks ) => {
				const newIntersectingBlocks = new Set( oldIntersectingBlocks );
				for ( const entry of entries ) {
					const clientId = entry.target.getAttribute( 'data-block' );
					const action = entry.isIntersecting ? 'add' : 'delete';
					newIntersectingBlocks[ action ]( clientId );
				}
				return newIntersectingBlocks;
			} );
		} );
	}, [ setIntersectingBlocks ] );
	const { order, selectedBlocks } = useSelect(
		( select ) => {
			const { getBlockOrder, getSelectedBlockClientIds } = select(
				blockEditorStore
			);
			return {
				order: getBlockOrder( rootClientId ),
				selectedBlocks: getSelectedBlockClientIds(),
			};
		},
		[ rootClientId ]
	);

	return (
		<LayoutProvider value={ layout }>
			{ order.map( ( clientId, index ) => (
				<AsyncModeProvider
					key={ clientId }
					value={
						// Only provide data asynchronously if the block is not
						// visible and not selected.
						! intersectingBlocks.has( clientId ) &&
						! selectedBlocks.includes( clientId )
					}
				>
					<IntersectionObserver.Provider
						value={ intersectionObserver }
					>
						<BlockListBlock
							rootClientId={ rootClientId }
							clientId={ clientId }
							// This prop is explicitely computed and passed down
							// to avoid being impacted by the async mode
							// otherwise there might be a small delay to trigger the animation.
							index={ index }
						/>
					</IntersectionObserver.Provider>
				</AsyncModeProvider>
			) ) }
			{ order.length < 1 && placeholder }
			<BlockListAppender
				tagName={ __experimentalAppenderTagName }
				rootClientId={ rootClientId }
				renderAppender={ renderAppender }
			/>
		</LayoutProvider>
	);
}

export function BlockListItems( props ) {
	// This component needs to always be synchronous as it's the one changing
	// the async mode depending on the block selection.
	return (
		<AsyncModeProvider value={ false }>
			<Items { ...props } />
		</AsyncModeProvider>
	);
}
