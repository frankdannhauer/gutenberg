/**
 * External dependencies
 */
import { capitalize, get, kebabCase, reduce, startsWith } from 'lodash';

/**
 * WordPress dependencies
 */
import { __EXPERIMENTAL_STYLE_PROPERTY as STYLE_PROPERTY } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import {
	LINK_COLOR_DECLARATION,
	PRESET_METADATA,
	ROOT_BLOCK_SELECTOR,
} from './utils';

function compileStyleValue( uncompiledValue ) {
	const VARIABLE_REFERENCE_PREFIX = 'var:';
	const VARIABLE_PATH_SEPARATOR_TOKEN_ATTRIBUTE = '|';
	const VARIABLE_PATH_SEPARATOR_TOKEN_STYLE = '--';
	if ( startsWith( uncompiledValue, VARIABLE_REFERENCE_PREFIX ) ) {
		const variable = uncompiledValue
			.slice( VARIABLE_REFERENCE_PREFIX.length )
			.split( VARIABLE_PATH_SEPARATOR_TOKEN_ATTRIBUTE )
			.join( VARIABLE_PATH_SEPARATOR_TOKEN_STYLE );
		return `var(--wp--${ variable })`;
	}
	return uncompiledValue;
}

/**
 * Transform given preset tree into a set of style declarations.
 *
 * @param {Object} blockPresets
 *
 * @return {Array} An array of style declarations.
 */
function getBlockPresetsDeclarations( blockPresets = {} ) {
	return reduce(
		PRESET_METADATA,
		( declarations, { path, valueKey, cssVarInfix } ) => {
			const preset = get( blockPresets, path, [] );
			preset.forEach( ( value ) => {
				declarations.push(
					`--wp--preset--${ cssVarInfix }--${ value.slug }: ${ value[ valueKey ] }`
				);
			} );
			return declarations;
		},
		[]
	);
}

/**
 * Transform given preset tree into a set of preset class declarations.
 *
 * @param {string} blockSelector
 * @param {Object} blockPresets
 * @return {string} CSS declarations for the preset classes.
 */
function getBlockPresetClasses( blockSelector, blockPresets = {} ) {
	return reduce(
		PRESET_METADATA,
		( declarations, { path, valueKey, classes } ) => {
			if ( ! classes ) {
				return declarations;
			}
			classes.forEach( ( { classSuffix, propertyName } ) => {
				const presets = get( blockPresets, path, [] );
				presets.forEach( ( preset ) => {
					const slug = preset.slug;
					const value = preset[ valueKey ];
					const classSelectorToUse = `.has-${ slug }-${ classSuffix }`;
					const selectorToUse = `${ blockSelector }${ classSelectorToUse }`;
					declarations += `${ selectorToUse } {${ propertyName }: ${ value };}`;
				} );
			} );
			return declarations;
		},
		''
	);
}

function flattenTree( input = {}, prefix, token ) {
	let result = [];
	Object.keys( input ).forEach( ( key ) => {
		const newKey = prefix + kebabCase( key.replace( '/', '-' ) );
		const newLeaf = input[ key ];

		if ( newLeaf instanceof Object ) {
			const newPrefix = newKey + token;
			result = [ ...result, ...flattenTree( newLeaf, newPrefix, token ) ];
		} else {
			result.push( `${ newKey }: ${ newLeaf }` );
		}
	} );
	return result;
}

/**
 * Transform given style tree into a set of style declarations.
 *
 * @param {Object} blockStyles   Block styles.
 *
 * @return {Array} An array of style declarations.
 */
function getBlockStylesDeclarations( blockStyles = {} ) {
	return reduce(
		STYLE_PROPERTY,
		( declarations, { value, properties }, key ) => {
			if ( !! properties ) {
				properties.forEach( ( prop ) => {
					if ( ! get( blockStyles, [ ...value, prop ], false ) ) {
						// Do not create a declaration
						// for sub-properties that don't have any value.
						return;
					}
					const cssProperty = key.startsWith( '--' )
						? key
						: kebabCase( `${ key }${ capitalize( prop ) }` );
					declarations.push(
						`${ cssProperty }: ${ compileStyleValue(
							get( blockStyles, [ ...value, prop ] )
						) }`
					);
				} );
			} else if ( get( blockStyles, value, false ) ) {
				const cssProperty = key.startsWith( '--' )
					? key
					: kebabCase( key );
				declarations.push(
					`${ cssProperty }: ${ compileStyleValue(
						get( blockStyles, value )
					) }`
				);
			}

			return declarations;
		},
		[]
	);
}

export default ( blockData, tree, type = 'all' ) => {
	// Can this be converted to a context, as the global context?
	// See comment in the server.
	const styles =
		type === 'all' || type === 'blockStyles'
			? [ LINK_COLOR_DECLARATION ]
			: [];

	// Process top-level.
	if ( type === 'all' || type === 'cssVariables' ) {
		const declarations = [
			...getBlockPresetsDeclarations( tree?.settings ),
			...flattenTree( tree?.settings?.custom, '--wp--custom--', '--' ),
		];
		if ( declarations.length > 0 ) {
			styles.push(
				`${ ROOT_BLOCK_SELECTOR } { ${ declarations.join( ';' ) } }`
			);
		}
	}

	if ( type === 'all' || type === 'blockStyles' ) {
		const declarations = getBlockStylesDeclarations( tree?.styles );
		if ( declarations.length > 0 ) {
			styles.push(
				`${ ROOT_BLOCK_SELECTOR } { ${ declarations.join( ';' ) } }`
			);
		}

		const presetClasses = getBlockPresetClasses(
			ROOT_BLOCK_SELECTOR,
			tree?.settings
		);
		if ( presetClasses ) {
			styles.push( presetClasses );
		}
	}

	// Process blocks.
	return reduce(
		blockData,
		( accumulator, { blockName, selector } ) => {
			if ( type === 'all' || type === 'cssVariables' ) {
				const declarations = [
					...getBlockPresetsDeclarations(
						tree?.settings?.blocks?.[ blockName ]
					),
					...flattenTree(
						tree?.settings?.blocks?.[ blockName ]?.custom,
						'--wp--custom--',
						'--'
					),
				];

				if ( declarations.length > 0 ) {
					accumulator.push(
						`${ selector } { ${ declarations.join( ';' ) } }`
					);
				}
			}
			if ( type === 'all' || type === 'blockStyles' ) {
				const declarations = getBlockStylesDeclarations(
					tree?.styles?.blocks?.[ blockName ]
				);

				if ( declarations.length > 0 ) {
					accumulator.push(
						`${ selector } { ${ declarations.join( ';' ) } }`
					);
				}

				const presetClasses = getBlockPresetClasses(
					selector,
					tree?.settings?.blocks?.[ blockName ]
				);
				if ( presetClasses ) {
					accumulator.push( presetClasses );
				}
			}
			return accumulator;
		},
		styles
	).join( '' );
};
