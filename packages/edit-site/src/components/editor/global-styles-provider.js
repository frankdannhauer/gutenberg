/**
 * External dependencies
 */
import { set, get, mergeWith } from 'lodash';

/**
 * WordPress dependencies
 */
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
} from '@wordpress/element';
import {
	__EXPERIMENTAL_STYLE_PROPERTY as STYLE_PROPERTY,
	store as blocksStore,
} from '@wordpress/blocks';
import { useEntityProp } from '@wordpress/core-data';
import { useSelect, useDispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */
import {
	ROOT_BLOCK_NAME,
	ROOT_BLOCK_SELECTOR,
	ROOT_BLOCK_SUPPORTS,
	getValueFromVariable,
	getPresetVariable,
} from './utils';
import getGlobalStyles from './global-styles-renderer';
import { store as editSiteStore } from '../../store';

const EMPTY_CONTENT = { isGlobalStylesUserThemeJSON: true, version: 1 };
const EMPTY_CONTENT_STRING = JSON.stringify( EMPTY_CONTENT );

const GlobalStylesContext = createContext( {
	/* eslint-disable no-unused-vars */
	getSetting: ( context, path ) => {},
	setSetting: ( context, path, newValue ) => {},
	getStyle: ( context, propertyName, origin ) => {},
	setStyle: ( context, propertyName, newValue ) => {},
	contexts: {},
	/* eslint-enable no-unused-vars */
} );

const mergeTreesCustomizer = ( objValue, srcValue ) => {
	// We only pass as arrays the presets,
	// in which case we want the new array of values
	// to override the old array (no merging).
	if ( Array.isArray( srcValue ) ) {
		return srcValue;
	}
};

export const useGlobalStylesContext = () => useContext( GlobalStylesContext );

const useGlobalStylesEntityContent = () => {
	return useEntityProp( 'postType', 'wp_global_styles', 'content' );
};

export const useGlobalStylesReset = () => {
	const [ content, setContent ] = useGlobalStylesEntityContent();
	const canRestart = !! content && content !== EMPTY_CONTENT_STRING;
	return [
		canRestart,
		useCallback( () => setContent( EMPTY_CONTENT_STRING ), [ setContent ] ),
	];
};

const extractSupportKeys = ( supports ) => {
	const supportKeys = [];
	Object.keys( STYLE_PROPERTY ).forEach( ( name ) => {
		if ( get( supports, STYLE_PROPERTY[ name ].support, false ) ) {
			supportKeys.push( name );
		}
	} );
	return supportKeys;
};

const getContexts = ( blockTypes ) => {
	const result = {};

	// Add contexts from block metadata.
	blockTypes.forEach( ( blockType ) => {
		const blockName = blockType.name;
		const blockSelector = blockType?.supports?.__experimentalSelector;
		const supports = extractSupportKeys( blockType?.supports );
		const hasSupport = supports.length > 0;

		if ( hasSupport && typeof blockSelector === 'string' ) {
			result[ blockName ] = {
				selector: blockSelector,
				supports,
				blockName,
			};
		} else if ( hasSupport ) {
			const suffix = blockName.replace( 'core/', '' ).replace( '/', '-' );
			result[ blockName ] = {
				selector: '.wp-block-' + suffix,
				supports,
				blockName,
			};
		}
	} );

	return result;
};

export default function GlobalStylesProvider( { children, baseStyles } ) {
	const [ content, setContent ] = useGlobalStylesEntityContent();
	const { blockTypes, settings } = useSelect( ( select ) => {
		return {
			blockTypes: select( blocksStore ).getBlockTypes(),
			settings: select( editSiteStore ).getSettings(),
		};
	} );
	const { updateSettings } = useDispatch( editSiteStore );

	const contexts = useMemo( () => getContexts( blockTypes ), [ blockTypes ] );

	const { userStyles, mergedStyles } = useMemo( () => {
		let newUserStyles;
		try {
			// TODO: IF USER STYLES AREN'T IN THE LAST VERSION
			// WE SHOULD MIGRATE THEM.
			newUserStyles = content ? JSON.parse( content ) : EMPTY_CONTENT;
		} catch ( e ) {
			/* eslint-disable no-console */
			console.error( 'User data is not JSON' );
			console.error( e );
			/* eslint-enable no-console */
			newUserStyles = EMPTY_CONTENT;
		}

		// It is very important to verify if the flag isGlobalStylesUserThemeJSON is true.
		// If it is not true the content was not escaped and is not safe.
		if ( ! newUserStyles.isGlobalStylesUserThemeJSON ) {
			newUserStyles = EMPTY_CONTENT;
		}
		// TODO: we probably want to check here that the shape is what we want
		// This is, settings & styles are top-level keys, or perhaps a version.
		// As to avoid merging trees that are different.
		const newMergedStyles = mergeWith(
			{},
			baseStyles,
			newUserStyles,
			mergeTreesCustomizer
		);

		return {
			userStyles: newUserStyles,
			mergedStyles: newMergedStyles,
		};
	}, [ content ] );

	const nextValue = useMemo(
		() => ( {
			root: {
				selector: ROOT_BLOCK_SELECTOR,
				supports: ROOT_BLOCK_SUPPORTS,
				name: ROOT_BLOCK_NAME,
			},
			contexts,
			getSetting: ( blockName, propertyPath ) => {
				const path =
					blockName === ROOT_BLOCK_NAME
						? propertyPath
						: [ 'blocks', blockName, ...propertyPath ];
				get( userStyles?.settings, path );
			},
			setSetting: ( blockName, propertyPath, newValue ) => {
				const newContent = { ...userStyles };
				const path =
					blockName === ROOT_BLOCK_NAME
						? [ 'settings' ]
						: [ 'settings', 'blocks', blockName ];

				let newSettings = get( newContent, path );
				if ( ! newSettings ) {
					newSettings = {};
					set( newContent, path, newSettings );
				}
				set( newSettings, propertyPath, newValue );

				setContent( JSON.stringify( newContent ) );
			},
			getStyle: ( blockName, propertyName, origin = 'merged' ) => {
				const styleOrigin =
					'user' === origin ? userStyles : mergedStyles;

				const propertyPath = STYLE_PROPERTY[ propertyName ].value;
				const path =
					blockName === ROOT_BLOCK_NAME
						? propertyPath
						: [ 'blocks', blockName, ...propertyPath ];

				const value = get( styleOrigin?.styles, path );
				return getValueFromVariable( mergedStyles, blockName, value );
			},
			setStyle: ( blockName, propertyName, newValue ) => {
				const newContent = { ...userStyles };
				const path =
					ROOT_BLOCK_NAME === blockName
						? [ 'styles' ]
						: [ 'styles', 'blocks', blockName ];
				let newStyles = get( newContent, path );
				if ( ! newStyles ) {
					newStyles = {};
					set( newContent, path, newStyles );
				}
				set(
					newStyles,
					STYLE_PROPERTY[ propertyName ].value,
					getPresetVariable(
						mergedStyles,
						path,
						propertyName,
						newValue
					)
				);
				setContent( JSON.stringify( newContent ) );
			},
		} ),
		[ content, mergedStyles ]
	);

	useEffect( () => {
		const newStyles = settings.styles.filter(
			( style ) => ! style.isGlobalStyles
		);
		updateSettings( {
			...settings,
			styles: [
				...newStyles,
				{
					css: getGlobalStyles(
						contexts,
						mergedStyles,
						'cssVariables'
					),
					isGlobalStyles: true,
					__experimentalNoWrapper: true,
				},
				{
					css: getGlobalStyles(
						contexts,
						mergedStyles,
						'blockStyles'
					),
					isGlobalStyles: true,
				},
			],
			__experimentalFeatures: mergedStyles.settings,
		} );
	}, [ contexts, mergedStyles ] );

	return (
		<GlobalStylesContext.Provider value={ nextValue }>
			{ children }
		</GlobalStylesContext.Provider>
	);
}
