# Zyn

A lightweight, zero-dependency schema validation library for TypeScript. Describe the shape of your data once, validate it at runtime, and get the TypeScript type for free.

## Installation

```
npm install @algol007/zyn
```

Zyn ships ESM and CommonJS builds with bundled type definitions. It needs TypeScript 5 or newer if you use the types.

## Quick start

Build a schema with the `zyn` factory, then call `parse` or `safeParse` on your data.

```
import { zyn, type Infer } from '@algol007/zyn';

const User = zyn.object({
  name:  zyn.string().min(2),
  email: zyn.string().email(),
  age:   zyn.number().min(18).max(120),
  tags:  zyn.array(zyn.string()),
});

type User = Infer<typeof User>;

const result = User.safeParse(input);

if (result.success) {
  console.log(result.data.email);
} else {
  console.error(result.error.message);
}
```

## Try it

This playground runs the same rules as the schema below. Edit the JSON and watch the result change.

Input (JSON)

Result

```

```

Schema

```
zyn.object({
  name: zyn.string().min(2),
  email: zyn.string().email(),
  age: zyn.number().min(18).max(120),
  tags: zyn.array(zyn.string()),
  newsletter: zyn.boolean().optional(),
})
```

## zyn.string()

Accepts values whose type is `string`.

| Method         | Description                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------- |
| `.min(length)` | Requires at least `length` characters.                                                      |
| `.email()`     | Requires a basic email format: text, an `@`, a domain, a dot, and a suffix, with no spaces. |

```
zyn.string().min(3).parse('hello');       // 'hello'
zyn.string().email().parse('nope');      // throws: Invalid email format
```

## zyn.number()

Accepts numbers. `NaN` is rejected.

| Method        | Description                                        |
| ------------- | -------------------------------------------------- |
| `.min(value)` | Requires a value greater than or equal to `value`. |
| `.max(value)` | Requires a value less than or equal to `value`.    |

```
zyn.number().min(0).max(100).parse(42);   // 42
zyn.number().parse('42');                // throws: Expected number, received string
```

## zyn.boolean()

Accepts `true` or `false`. Other values, including `"true"` and `1`, are rejected.

```
zyn.boolean().parse(true);   // true
```

## zyn.array(itemSchema)

Accepts an array where every item matches `itemSchema`. The result is a new array containing the parsed items.

```
zyn.array(zyn.number()).parse([1, 2, 3]);   // [1, 2, 3]
zyn.array(zyn.number()).parse([1, 'x']);     // throws: At index 1: Expected number, received string
```

## zyn.object(shape)

Accepts a plain object. `shape` maps each key to a schema. Arrays and `null` are rejected. Schemas can be nested as deep as you need.

```
const Order = zyn.object({
  id: zyn.number(),
  customer: zyn.object({ name: zyn.string() }),
});

Order.parse({ id: 1, customer: { name: 'Ada' } });
Order.parse({ id: 1, customer: { name: 5 } });
// throws: At key "customer": At key "name": Expected string, received number
```

## .optional()

Available on every schema. An optional schema also accepts `undefined` or `null` and returns the value unchanged. Anything else is validated normally.

```
const Profile = zyn.object({
  nickname: zyn.string().min(2).optional(),
});

Profile.parse({});                    // { nickname: undefined }
Profile.parse({ nickname: 'Ad' });     // { nickname: 'Ad' }
```

Call `.optional()` last. It returns a base schema type, so `.min()`, `.max()` and `.email()` are no longer available after it. It also modifies the schema it is called on instead of creating a copy.

## parse and safeParse

Every schema has two ways to validate data.

| Method            | On success                         | On failure                           |
| ----------------- | ---------------------------------- | ------------------------------------ |
| `parse(data)`     | Returns the typed data.            | Throws an `Error`.                   |
| `safeParse(data)` | Returns `{ success: true, data }`. | Returns `{ success: false, error }`. |

Use `safeParse` when invalid input is expected, such as form or request validation, and you would rather branch than catch.

```
type ParseResult<T> =
  | { success: true;  data: T }
  | { success: false; error: Error };
```

## Type inference

`Infer` extracts the TypeScript type from a schema, so you never write the type twice.

```
const Point = zyn.object({ x: zyn.number(), y: zyn.number() });
type Point = Infer<typeof Point>;   // { x: number; y: number }
```

## Error messages

Errors are standard `Error` objects. Messages for nested values are prefixed with the path to the failing value.

| Cause            | Message                                     |
| ---------------- | ------------------------------------------- |
| Wrong type       | `Expected string, received number`          |
| String too short | `String must be at least N characters long` |
| Invalid email    | `Invalid email format`                      |
| Number too small | `Number must be greater than or equal to N` |
| Number too large | `Number must be less than or equal to N`    |
| Array item       | `At index 2: …`                             |
| Object key       | `At key "age": …`                           |

## Good to know

**Validation stops at the first error.** You get one message per failed parse, not a list of every problem.

**Unknown keys are dropped.** `object` returns only the keys declared in its shape.

**No coercion.** A string like `"42"` is not turned into a number.

**Exports.** The package exports the `zyn` factory, the `Infer` type, `ParseResult`, and the classes `ZynType`, `ZynString`, `ZynNumber`, `ZynBoolean`, `ZynArray` and `ZynObject`.

MIT licensed. Source on [GitHub](https://github.com/algol007/zyn), package on [npm](https://www.npmjs.com/package/@algol007/zyn).
