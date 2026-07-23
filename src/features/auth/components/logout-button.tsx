import { Button } from "@/components/ui";
import { logout } from "../application/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" size="sm">
        התנתקות
      </Button>
    </form>
  );
}
