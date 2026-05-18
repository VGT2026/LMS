/** mysql2 may return BOOLEAN as 0/1 or true/false. */
export function userIsActive(isActive: boolean | number | string | null | undefined): boolean {
  return isActive === true || isActive === 1 || isActive === '1';
}
