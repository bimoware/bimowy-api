import { Language, LocaleString, LocaleStringRecord } from "../defs"

// Contexts
export type ContextElement =
	| {
			type: "text"
			text: string
			extra?: ("mono" | "latex")[]
	  }
	| { type: "input"; id: string }

export type ContextSection = {
	type: "p"
	content: ContextElement[]
}
// Base Option
type BaseOptionConfig = {
	title: LocaleStringRecord
	defaultValue: unknown
}

export abstract class OptionBase<
	T extends OptionType,
	C extends BaseOptionConfig
> {
	constructor(
		public type: T,
		public config: C
	) {}
	serialize(lang: Language) {
		return {
			type: this.type,
			...this.config,
			title: this.config.title?.[lang]
		}
	}
}

// User
type ExtractDefaults<O extends Record<string, OptionBase<any, any>>> = {
	[K in keyof O]: O[K]["config"]["defaultValue"]
}

export type UserOptions = Record<string, unknown> & { _n: number }
export type UserAnswers = Record<string, unknown>

export enum OptionType {
	Number = "number",
	Radio = "radio",
	Interval = "interval",
	Boolean = "boolean",
	Checkboxes = "checkboxes"
}
// Number
type NumberConfig = BaseOptionConfig & {
	defaultValue: number
	min?: number
	max?: number
}
export class NumberOption extends OptionBase<OptionType.Number, NumberConfig> {
	constructor(public config: NumberConfig) {
		super(OptionType.Number, config)
	}
}

// Boolenan
type BooleanConfig = BaseOptionConfig & {
	defaultValue: boolean
}
export class BooleanOption extends OptionBase<
	OptionType.Boolean,
	BooleanConfig
> {
	constructor(public config: BooleanConfig) {
		super(OptionType.Boolean, config)
	}
}

// Radio
type AllowedRadioOptionType = number | string
type RadioConfig<T> = BaseOptionConfig & {
	options: T[]
	defaultValue: T
}

export class RadioOption<T extends AllowedRadioOptionType> extends OptionBase<
	OptionType.Radio,
	RadioConfig<T>
> {
	constructor(public config: RadioConfig<T>) {
		super(OptionType.Radio, config)
	}
}

// Radio
type IntervalConfig = BaseOptionConfig & {
	defaultValue: [number, number]
}

export class IntervalOption extends OptionBase<
	OptionType.Interval,
	IntervalConfig
> {
	constructor(public config: IntervalConfig) {
		super(OptionType.Interval, config)
	}
}

// Checkboxes
type CheckboxesConfig<T> = BaseOptionConfig & {
	defaultValue: T[]
	options: T[]
}

export class CheckboxesOption<T> extends OptionBase<
	OptionType.Checkboxes,
	CheckboxesConfig<T>
> {
	constructor(public config: CheckboxesConfig<T>) {
		super(OptionType.Checkboxes, config)
	}
}

// ..

export type UnknownExercise = ExerciseBuilder<
	unknown[],
	{ [key: string]: unknown },
	{ [key: string]: OptionBase<any, any> }
>

export type APIOption = ReturnType<
	(
		| NumberOption
		| RadioOption<any>
		| IntervalOption
		| BooleanOption
		| CheckboxesOption<any>
	)["serialize"]
>

export type APIOptions = Record<string, APIOption>
// ExerciseBuilder
type ExerciseData = {
	id: string
	beta: boolean
	nameLocalizations: LocaleStringRecord | null
	descLocalizations: LocaleStringRecord | null
	tags: string[]
}

export const DEFAULT_N_QUESTIONS_ID = "_n"
export const DEFAULT_N_QUESTIONS_OPTION = new NumberOption({
	defaultValue: 5,
	max: 10,
	min: 1,
	title: {
		en: "Number of questions",
		fr: "Nombre de questions"
	}
})
export class ExerciseBuilder<
	const Seed extends any[] = [],
	const Answers extends Record<string, any> = {},
	const Opts extends Record<string, OptionBase<any, any>> = {}
> {
	// Properties
	public options: Record<string, OptionBase<any, any>> = {}
	public rawData: ExerciseData = {
		id: "",
		beta: false,
		nameLocalizations: null,
		descLocalizations: null,
		tags: []
	}

	// Constructor
	constructor(id: string) {
		this.rawData.id = id
		this.validateAnswers = (seed, answers) => {
			const correction = this.generateSolution(seed)
			const result = {} as { [K in keyof Answers]: boolean }
			for (const key in answers) {
				result[key] = answers[key] == correction[key]
			}
			return result
		}
		return this
	}
	// Methods
	generateSeed!: (userOptions: ExtractDefaults<Opts>) => Seed
	generateContext!: (seed: Seed, lang: Language) => ContextSection[]
	validateAnswers!: (
		seed: Seed,
		answers: Answers
	) => { [K in keyof Answers]: boolean }
	generateSolution!: (seed: Seed) => Answers

	// Getters
	get id() {
		return this.rawData.id
	}

	// Builders
	setName(names: LocaleString) {
		if (typeof names == "string") {
			this.rawData.nameLocalizations = {
				fr: names,
				en: names
			}
		} else {
			this.rawData.nameLocalizations = names
		}
		return this
	}
	setDescription(desc: LocaleString) {
		if (typeof desc == "string") {
			this.rawData.descLocalizations = {
				fr: desc,
				en: desc
			}
		} else {
			this.rawData.descLocalizations = desc
		}
		return this
	}
	setIsBeta(isBeta: boolean) {
		this.rawData.beta = isBeta
		return this
	}
	setTags(tags: string[]) {
		this.rawData.tags = tags
		return this
	}
	// now addOption only needs O—you get K for free:
	addOption<const ID extends string, const O extends OptionBase<any, any>>(
		id: ID,
		option: O
	): ExerciseBuilder<
		Seed,
		Answers,
		Opts & {
			[A in ID]: O
		}
	> {
		if (this.options[id]) {
			console.error(this.serialize("en"))
			throw new Error(`Duplicate option ID: ${id} for exercise ${this.id}`)
		}
		this.options[id] = option
		return this as any
	}
	setSeedGenerator(
		seedGenerator: (userOptions: ExtractDefaults<Opts>) => Seed
	) {
		this.generateSeed = seedGenerator
		return this
	}
	setContextGenerator(
		contextGenerator: (seed: Seed, lang: Language) => ContextSection[]
	) {
		this.generateContext = contextGenerator
		return this
	}
	setAnswersValidator(
		answersValidator: (
			seed: Seed,
			answers: Answers
		) => { [K in keyof Answers]: boolean }
	) {
		this.validateAnswers = answersValidator
		return this
	}
	setSolutionGenerator(solutionGenerator: (seed: Seed) => Answers) {
		this.generateSolution = solutionGenerator
		return this
	}
	serialize(lang: Language) {
		const { nameLocalizations, descLocalizations, tags, beta, id } =
			this.rawData
		const options = Object.entries(this.options).reduce(
			(o, [id, option]) => {
				return {
					...o,
					[id]: option.serialize(lang)
				}
			},
			{ [DEFAULT_N_QUESTIONS_ID]: DEFAULT_N_QUESTIONS_OPTION.serialize(lang) }
		) as APIOptions

		return {
			beta,
			tags,
			id,
			options,
			name: nameLocalizations![lang],
			desc: descLocalizations?.[lang] ?? null
		}
	}
	generate(userOptions: ExtractDefaults<Opts>, lang: Language) {
		const seed = this.generateSeed(userOptions)
		const context = this.generateContext(seed, lang)
		return {
			exercise_id: this.id,
			seed,
			context
		}
	}
}
