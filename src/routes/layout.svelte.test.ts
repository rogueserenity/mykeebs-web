import { afterEach, describe, expect, it } from 'vitest';
import './layout.css';

function field(classes: string): HTMLInputElement {
	const container = document.createElement('div');
	container.style.width = '400px';
	const input = document.createElement('input');
	input.className = classes;
	container.append(input);
	document.body.append(container);
	return input;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('field-input', () => {
	it('fills its container by default', () => {
		expect(field('field-input').offsetWidth).toBe(400);
	});

	it('gives way to a width utility', () => {
		expect(field('field-input w-20').offsetWidth).toBe(80);
	});

	it('gives way to a font utility', () => {
		const plain = getComputedStyle(field('field-input')).fontFamily;
		const mono = getComputedStyle(field('field-input font-mono')).fontFamily;

		expect(mono).not.toBe(plain);
	});
});
