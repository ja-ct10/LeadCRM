---
inclusion: fileMatch
fileMatchPattern: "*.ts,*.tsx"
description: TypeScript and JavaScript patterns extending common rules. Loaded when editing TypeScript files.
---

# TypeScript/JavaScript Patterns

> Loaded automatically when editing `.ts` or `.tsx` files.

## API Response Format

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
  }
}
```

## Custom Hooks Pattern

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

## Repository Pattern

```typescript
interface Repository<T> {
  findAll(filters?: Filters): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: CreateDto): Promise<T>
  update(id: string, data: UpdateDto): Promise<T>
  delete(id: string): Promise<void>
}
```

## Type Safety Rules

- No `any` — use `unknown` and narrow, or define a proper type
- Named `interface` for all component props
- Explicit return types on all exported functions
- `unknown` in catch blocks — narrow with `instanceof Error`

```typescript
// WRONG
} catch (error: any) {
  toast.error(error.message)
}

// CORRECT
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : 'An unexpected error occurred'
  toast.error(message)
}
```

## Immutable State Updates

```typescript
// WRONG — mutation
contact.status = 'Hot'
contacts.push(newContact)

// CORRECT — new objects
const updated = { ...contact, status: 'Hot' }
const newList  = [...contacts, newContact]
```
