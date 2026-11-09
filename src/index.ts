export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

export abstract class ZynType<T> {
  protected isOptional = false;
  protected defaultValue?: T;
  protected refinements: Array<{
    check: (value: T) => boolean;
    message: string;
  }> = [];

  abstract parse(data: unknown): T;

  safeParse(data: unknown): ParseResult<T> {
    try {
      return { success: true, data: this.parse(data) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  protected clone(): this {
    const copy = Object.create(Object.getPrototypeOf(this));
    Object.assign(copy, this);
    copy.refinements = [...this.refinements];
    return copy;
  }

  optional(): ZynType<T | undefined> {
    const copy = this.clone();
    copy.isOptional = true;
    return copy as unknown as ZynType<T | undefined>;
  }

  default(val: T): this {
    const copy = this.clone();
    copy.defaultValue = val;
    return copy;
  }

  refine(
    check: (value: T) => boolean,
    messageOrOptions?: string | { message?: string },
  ): this {
    const message =
      typeof messageOrOptions === "string"
        ? messageOrOptions
        : messageOrOptions?.message ||
          "Invalid input (failed custom refinement)";
    const copy = this.clone();
    copy.refinements.push({ check, message });
    return copy;
  }

  protected get refinementList() {
    return this.refinements;
  }

  protected handleOptionalAndDefault(data: unknown): {
    handled: boolean;
    value?: T;
  } {
    if (data === undefined || data === null) {
      if (this.defaultValue !== undefined) {
        return { handled: true, value: this.defaultValue };
      }
      if (this.isOptional) {
        return { handled: true, value: undefined as any };
      }
    }
    return { handled: false };
  }

  protected runRefinements(value: T): T {
    for (const ref of this.refinementList) {
      if (!ref.check(value)) {
        throw new Error(ref.message);
      }
    }
    return value;
  }
}

// --- STRING VALIDATOR ---
export class ZynString extends ZynType<string> {
  private minLength?: { value: number; message?: string };
  private emailCheck?: { message?: string };

  parse(data: unknown): string {
    const opt = this.handleOptionalAndDefault(data);
    if (opt.handled) return opt.value as string;

    if (typeof data !== "string") {
      throw new Error(`Expected string, received ${typeof data}`);
    }
    if (this.minLength !== undefined && data.length < this.minLength.value) {
      throw new Error(
        this.minLength.message ||
          `String must be at least ${this.minLength.value} characters long`,
      );
    }
    if (this.emailCheck) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data)) {
        throw new Error(this.emailCheck.message || "Invalid email format");
      }
    }
    return this.runRefinements(data);
  }

  min(length: number, messageOrOptions?: string | { message?: string }): this {
    const message =
      typeof messageOrOptions === "string"
        ? messageOrOptions
        : messageOrOptions?.message;
    const copy = this.clone();
    copy.minLength = { value: length, message };
    return copy;
  }

  email(messageOrOptions?: string | { message?: string }): this {
    const message =
      typeof messageOrOptions === "string"
        ? messageOrOptions
        : messageOrOptions?.message;
    const copy = this.clone();
    copy.emailCheck = { message };
    return copy;
  }
}

// --- NUMBER VALIDATOR ---
export class ZynNumber extends ZynType<number> {
  private minValue?: { value: number; message?: string };
  private maxValue?: { value: number; message?: string };

  parse(data: unknown): number {
    const opt = this.handleOptionalAndDefault(data);
    if (opt.handled) return opt.value as number;

    if (typeof data !== "number" || Number.isNaN(data)) {
      throw new Error(`Expected number, received ${typeof data}`);
    }
    if (this.minValue !== undefined && data < this.minValue.value) {
      throw new Error(
        this.minValue.message ||
          `Number must be greater than or equal to ${this.minValue.value}`,
      );
    }
    if (this.maxValue !== undefined && data > this.maxValue.value) {
      throw new Error(
        this.maxValue.message ||
          `Number must be less than or equal to ${this.maxValue.value}`,
      );
    }
    return this.runRefinements(data);
  }

  min(value: number, messageOrOptions?: string | { message?: string }): this {
    const message =
      typeof messageOrOptions === "string"
        ? messageOrOptions
        : messageOrOptions?.message;
    const copy = this.clone();
    copy.minValue = { value, message };
    return copy;
  }

  max(value: number, messageOrOptions?: string | { message?: string }): this {
    const message =
      typeof messageOrOptions === "string"
        ? messageOrOptions
        : messageOrOptions?.message;
    const copy = this.clone();
    copy.maxValue = { value, message };
    return copy;
  }
}

// --- BOOLEAN VALIDATOR ---
export class ZynBoolean extends ZynType<boolean> {
  parse(data: unknown): boolean {
    const opt = this.handleOptionalAndDefault(data);
    if (opt.handled) return opt.value as boolean;

    if (typeof data !== "boolean") {
      throw new Error(`Expected boolean, received ${typeof data}`);
    }
    return this.runRefinements(data);
  }
}

// --- ENUM VALIDATOR ---
export class ZynEnum<T extends readonly [string, ...string[]]> extends ZynType<
  T[number]
> {
  constructor(private values: T) {
    super();
  }

  parse(data: unknown): T[number] {
    const opt = this.handleOptionalAndDefault(data);
    if (opt.handled) return opt.value as T[number];

    if (typeof data !== "string" || !this.values.includes(data as any)) {
      throw new Error(
        `Expected one of [${this.values.join(", ")}], received '${data}'`,
      );
    }
    return this.runRefinements(data as T[number]);
  }
}

// --- ARRAY VALIDATOR ---
export class ZynArray<T extends ZynType<any>> extends ZynType<Infer<T>[]> {
  constructor(private itemType: T) {
    super();
  }

  parse(data: unknown): Infer<T>[] {
    const opt = this.handleOptionalAndDefault(data);
    if (opt.handled) return opt.value as Infer<T>[];

    if (!Array.isArray(data)) {
      throw new Error(`Expected array, received ${typeof data}`);
    }

    const result = data.map((item, index) => {
      try {
        return this.itemType.parse(item);
      } catch (err: any) {
        throw new Error(`At index ${index}: ${err.message}`);
      }
    });

    return this.runRefinements(result);
  }
}

// --- OBJECT VALIDATOR ---
type InferObject<T extends Record<string, ZynType<any>>> = {
  [K in keyof T]: T[K] extends ZynType<infer U> ? U : never;
};

type MergeShapes<
  A extends Record<string, ZynType<any>>,
  B extends Record<string, ZynType<any>>,
> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
      ? A[K]
      : never;
};

export class ZynObject<T extends Record<string, ZynType<any>>> extends ZynType<
  InferObject<T>
> {
  constructor(readonly shape: T) {
    super();
  }

  extend<U extends Record<string, ZynType<any>>>(
    shape: U,
  ): ZynObject<MergeShapes<T, U>> {
    return new ZynObject({ ...this.shape, ...shape } as MergeShapes<T, U>);
  }

  merge<U extends Record<string, ZynType<any>>>(
    other: ZynObject<U>,
  ): ZynObject<MergeShapes<T, U>> {
    return this.extend(other.shape);
  }

  parse(data: unknown): InferObject<T> {
    const opt = this.handleOptionalAndDefault(data);
    if (opt.handled) return opt.value as InferObject<T>;

    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error(`Expected object, received ${typeof data}`);
    }

    const result = {} as Record<string, any>;
    const inputObj = data as Record<string, any>;

    for (const key in this.shape) {
      try {
        result[key] = this.shape[key].parse(inputObj[key]);
      } catch (err: any) {
        throw new Error(`At key "${key}": ${err.message}`);
      }
    }

    return this.runRefinements(result as InferObject<T>);
  }
}

// --- COERCE VALIDATORS ---
export class ZynCoerceString extends ZynString {
  override parse(data: unknown): string {
    if (data !== undefined && data !== null && typeof data !== "string") {
      return super.parse(String(data));
    }
    return super.parse(data);
  }
}

export class ZynCoerceNumber extends ZynNumber {
  override parse(data: unknown): number {
    if (typeof data === "string" && data.trim() !== "") {
      const parsed = Number(data);
      return super.parse(parsed);
    }
    return super.parse(data);
  }
}

export class ZynCoerceBoolean extends ZynBoolean {
  override parse(data: unknown): boolean {
    if (data === "true" || data === 1) return super.parse(true);
    if (data === "false" || data === 0) return super.parse(false);
    return super.parse(data);
  }
}

// --- ZYN FACTORY & INFER TYPE ---
export const zyn = {
  string: () => new ZynString(),
  number: () => new ZynNumber(),
  boolean: () => new ZynBoolean(),
  enum: <T extends readonly [string, ...string[]]>(values: T) =>
    new ZynEnum(values),
  array: <T extends ZynType<any>>(itemType: T) => new ZynArray(itemType),
  object: <T extends Record<string, ZynType<any>>>(shape: T) =>
    new ZynObject(shape),

  // Coercion namespace
  coerce: {
    string: () => new ZynCoerceString(),
    number: () => new ZynCoerceNumber(),
    boolean: () => new ZynCoerceBoolean(),
  },
};

export type Infer<T extends ZynType<any>> =
  T extends ZynType<infer U> ? U : never;
