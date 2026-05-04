import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the version and official enrollment period", () => {
    render(<App />);

    expect(screen.getAllByText("v0.1.0").length).toBeGreaterThan(0);
    expect(screen.getByText("4 mai - 12 iunie 2026")).toBeInTheDocument();
  });

  it("filters and selects a circle", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText(/Cauta dupa cerc/i), "sah");
    await user.click(screen.getByRole("checkbox", { name: /Șah/i }));

    expect(screen.getByText("1 selectate")).toBeInTheDocument();
  });
});
