import { describe, expect, it } from 'vitest';
import { guessEquipmentType, parseMachineForm } from './machines';

function form(fields: Record<string, string | null>) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (value !== null) data.set(key, value);
	}
	return data;
}

describe('guessEquipmentType', () => {
	it('reconnaît les machines du catalogue', () => {
		expect(guessEquipmentType('TONDEUSE - CC256TV | ANOVA')).toBe('Tondeuse');
		expect(guessEquipmentType('Tracteur tondeuse a ramassage TR3801E-B')).toBe(
			'Tracteur tondeuse'
		);
		expect(guessEquipmentType('DEBROUSSAILLEUSE AUTOPORTEE SRA 950FA')).toBe('Tracteur tondeuse');
		expect(guessEquipmentType('Tronçonneuse 550 XP Mark II')).toBe('Tronçonneuse');
		expect(guessEquipmentType('Taille-haie thermique HS 45')).toBe('Taille-haie');
	});

	it('écarte les pièces détachées', () => {
		// Une pièce porte souvent le nom de la machine à laquelle elle se monte :
		// sans ce garde-fou, le parc se remplirait de consommables.
		expect(guessEquipmentType('Lame de tondeuse 46 cm')).toBeNull();
		expect(guessEquipmentType('Kit de réparation carburateur tronçonneuse')).toBeNull();
		expect(guessEquipmentType('Filtre à air tondeuse Briggs')).toBeNull();
		expect(guessEquipmentType('Courroie de tracteur tondeuse')).toBeNull();
	});

	it('ne reconnaît pas un article sans type identifiable', () => {
		expect(guessEquipmentType('Huile moteur SAE 30 - 1 L')).toBeNull();
		expect(guessEquipmentType('Gants de protection taille L')).toBeNull();
	});

	it('est insensible à la casse et aux accents du catalogue', () => {
		expect(guessEquipmentType('DÉBROUSSAILLEUSE THERMIQUE')).toBe('Débroussailleuse');
		expect(guessEquipmentType('tronconneuse elagueuse')).toBe('Tronçonneuse');
	});
});

describe('parseMachineForm', () => {
	it("exige le nom d'usage et le type (R4)", () => {
		expect(parseMachineForm(form({ equipmentType: 'Tondeuse' }))).toMatchObject({ ok: false });
		expect(parseMachineForm(form({ name: 'Ma tondeuse' }))).toMatchObject({ ok: false });
	});

	it('accepte une machine sans numéro de série (R4)', () => {
		const out = parseMachineForm(form({ name: 'Ma tondeuse', equipmentType: 'Tondeuse' }));
		expect(out.ok).toBe(true);
		if (out.ok) expect(out.values.serialNumber).toBeNull();
	});

	it('retient les informations moteur et garantie', () => {
		const out = parseMachineForm(
			form({
				name: 'Tondeuse du fond',
				equipmentType: 'Tondeuse',
				brand: 'Honda',
				serialNumber: 'SN-12345',
				engineModel: 'GCV160',
				warrantyEndDate: '2027-06-30'
			})
		);
		expect(out.ok).toBe(true);
		if (out.ok) {
			expect(out.values.serialNumber).toBe('SN-12345');
			expect(out.values.engineModel).toBe('GCV160');
			expect(out.values.warrantyEndDate?.getFullYear()).toBe(2027);
		}
	});

	it('ignore une date de garantie invalide plutôt que de rompre', () => {
		const out = parseMachineForm(
			form({ name: 'X', equipmentType: 'Tondeuse', warrantyEndDate: 'pas-une-date' })
		);
		expect(out.ok).toBe(true);
		if (out.ok) expect(out.values.warrantyEndDate).toBeNull();
	});
});
