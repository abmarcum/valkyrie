import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Login from "../app/login/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe("Login Component", () => {
  it("renders the welcome header and form elements", () => {
    render(<Login />);
    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. admin, user_john, viewer_alice/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In via OAuth 2.0/i })).toBeInTheDocument();
  });

  it("updates username state on input change", () => {
    render(<Login />);
    const input = screen.getByPlaceholderText(/e.g. admin, user_john, viewer_alice/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "john_dev" } });
    expect(input.value).toBe("john_dev");
  });
});
