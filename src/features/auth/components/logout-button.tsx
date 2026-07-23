import { logout } from "../application/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="text-sm underline">
        התנתקות
      </button>
    </form>
  );
}
