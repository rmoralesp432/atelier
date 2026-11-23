/** Shared, exact reference semantics for modeling, inspection and verification.
 * IDs take precedence over labels; ambiguity is never resolved by guessing. */
type ObjectRef = { id: string; name: string; groupId?: string | null };
type GroupRef = { id: string; name: string };
export function resolveGroupReference<T extends GroupRef>(
  ref: string,
  groups: T[],
) {
  const key = ref.startsWith('$group:') ? ref.slice(7) : ref;
  const id = groups.find((g) => g.id === key);
  if (id) return id;
  const matches = groups.filter((g) => g.name === key);
  if (matches.length > 1)
    throw Error('That group reference is ambiguous. Use its unique group ID.');
  return matches[0];
}
export function resolveObjectReference(
  ref: string,
  objects: ObjectRef[],
  groups: GroupRef[],
): string[] {
  const members = (g: GroupRef | undefined) =>
    g ? objects.filter((v) => v.groupId === g.id).map((v) => v.id) : [];
  if (ref.startsWith('$group:'))
    return members(resolveGroupReference(ref, groups));
  if (ref.startsWith('$name:')) {
    const matches = objects.filter((v) => v.name === ref.slice(6));
    if (matches.length > 1)
      throw Error('That object name is ambiguous. Use its unique object ID.');
    return matches.map((v) => v.id);
  }
  if (objects.some((v) => v.id === ref)) return [ref];
  const groupId = groups.find((g) => g.id === ref);
  if (groupId) return members(groupId);
  const named = objects.filter((v) => v.name === ref),
    namedGroups = groups.filter((g) => g.name === ref);
  if (named.length + namedGroups.length > 1)
    throw Error(
      'That reference is ambiguous. Use an object ID or $group:Unique group ID.',
    );
  return named.length ? [named[0].id] : members(namedGroups[0]);
}
