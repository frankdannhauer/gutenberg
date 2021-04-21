/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// import type {AggregatedResult, TestResult} from '@jest/test-result';
// import type { Reporter, Context } from '@jest/reporters';
// import type {Context} from './types';

// const { flatMap } = require( 'lodash' );

const newLine = /\n/g;
const encodedNewLine = '%0A';
const lineAndColumnInStackTrace = /^.*:([0-9]+):([0-9]+).*$/;

class GithubActionReporter {
	async onRunComplete( _contexts, _aggregatedResults ) {
		const messages = getMessages( _aggregatedResults?.testResults );

		for ( const message of messages ) {
			process.stderr.write( message + '\n' );
		}
	}
}

function getMessages( results ) {
	if ( ! results ) return [];

	return results.reduce(
		flatMap( ( { testFilePath, testResults } ) =>
			testResults
				.filter( ( r ) => r.status === 'failed' )
				.reduce(
					flatMap( ( r ) => r.failureMessages ),
					[]
				)
				.map( ( m ) => m.replace( newLine, encodedNewLine ) )
				.map( ( m ) => lineAndColumnInStackTrace.exec( m ) )
				//.filter((m): m is RegExpExecArray => m !== null)
				.map(
					( [ message, line, col ] ) =>
						`::error file=${ testFilePath },line=${ line },col=${ col }::${ message }`
				)
		),
		[]
	);
}

function flatMap( fn ) {
	return ( out, entry ) => out.concat( ...fn( entry ) );
}

// function flatMap< In, Out >( map: ( x: In ) => Array< Out > ) {
// 	return ( out: Array< Out >, entry: In ) => out.concat( ...map( entry ) );
// }

module.exports = GithubActionReporter;
