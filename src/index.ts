export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

export abstract class ZynType<T> {
  protected isOptional = false;

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

  optional(): ZynType<T | undefined> {
    this.isOptional = true;
    return this as unknown as ZynType<T | undefined>;
  }

  protected handleOptional(data: unknown): boolean {
    if (this.isOptional && (data === undefined || data === null)) {
      return true;
    }
    return false;
  }
}

// --- STRING VALIDATOR ---
export class ZynString extends ZynType<string> {
  private minLength?: number;
  private emailCheck = false;

  parse(data: unknown): string {
    if (this.handleOptional(data)) return data as any;

    if (typeof data !== 'string') {
      throw new Error(`Expected string, received ${typeof data}`);
    }
    if (this.minLength !== undefined && data.length < this.minLength) {
      throw new Error(`String must be at least ${this.minLength} characters long`);
    }
    if (this.emailCheck) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data)) {
        throw new Error('Invalid email format');
      }
    }
    return data;
  }

  min(length: number): this {
    this.minLength = length;
    return this;
  }

  email(): this {
    this.emailCheck = true;
    return this;
  }
}

// --- NUMBER VALIDATOR ---
export class ZynNumber extends ZynType<number> {
  private minValue?: number;
  private maxValue?: number;

  parse(data: unknown): number {
    if (this.handleOptional(data)) return data as any;

    if (typeof data !== 'number' || Number.isNaN(data)) {
      throw new Error(`Expected number, received ${typeof data}`);
    }
    if (this.minValue !== undefined && data < this.minValue) {
      throw new Error(`Number must be greater than or equal to ${this.minValue}`);
    }
    if (this.maxValue !== undefined && data > this.maxValue) {
      throw new Error(`Number must be less than or equal to ${this.maxValue}`);
    }
    return data;
  }

  min(value: number): this {
    this.minValue = value;
    return this;
  }

  max(value: number): this {
    this.maxValue = value;
    return this;
  }
}

// --- BOOLEAN VALIDATOR ---
export class ZynBoolean extends ZynType<boolean> {
  parse(data: unknown): boolean {
    if (this.handleOptional(data)) return data as any;

    if (typeof data !== 'boolean') {
      throw new Error(`Expected boolean, received ${typeof data}`);
    }
    return data;
  }
}

// --- ARRAY VALIDATOR ---
export class ZynArray<T extends ZynType<any>> extends ZynType<Infer<T>[]> {
  constructor(private itemType: T) {
    super();
  }

  parse(data: unknown): Infer<T>[] {
    if (this.handleOptional(data)) return data as any;

    if (!Array.isArray(data)) {
      throw new Error(`Expected array, received ${typeof data}`);
    }

    return data.map((item, index) => {
      try {
        return this.itemType.parse(item);
      } catch (err: any) {
        throw new Error(`At index ${index}: ${err.message}`);
      }
    });
  }
}

// --- OBJECT VALIDATOR ---
type InferObject<T extends Record<string, ZynType<any>>> = {
  [K in keyof T]: T[K] extends ZynType<infer U> ? U : never;
};

export class ZynObject<T extends Record<string, ZynType<any>>> extends ZynType<InferObject<T>> {
  constructor(private shape: T) {
    super();
  }

  parse(data: unknown): InferObject<T> {
    if (this.handleOptional(data)) return data as any;

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
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

    return result as InferObject<T>;
  }
}

// --- ZYN FACTORY & INFER TYPE ---
export const zyn = {
  string: () => new ZynString(),
  number: () => new ZynNumber(),
  boolean: () => new ZynBoolean(),
  array: <T extends ZynType<any>>(itemType: T) => new ZynArray(itemType),
  object: <T extends Record<string, ZynType<any>>>(shape: T) => new ZynObject(shape),
};

export type Infer<T extends ZynType<any>> = T extends ZynType<infer U> ? U : never;