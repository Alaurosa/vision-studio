import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export default async function TodosPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: todos, error } = await supabase.from('todos').select();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-semibold">Supabase Todos</h1>
      {error ? (
        <p className="text-sm text-red-600">Failed to load todos: {error.message}</p>
      ) : (
        <ul className="space-y-2">
          {todos?.map((todo: { id: string; name: string }) => (
            <li key={todo.id}>{todo.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
