import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the version and official enrollment period", () => {
    render(<App />);

    expect(screen.getAllByText(/Frontend v0.1.0/).length).toBeGreaterThan(0);
    expect(screen.getByText("4 mai - 12 iunie 2026")).toBeInTheDocument();
    expect(screen.getByText(/Florin Badita/)).toBeInTheDocument();
  });

  it("filters and selects a circle", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<App />);

    await user.type(screen.getByPlaceholderText(/Cauta un cerc/i), "sah");
    await user.click(screen.getByRole("checkbox", { name: /Șah/i }));

    expect(screen.getAllByText("1 cerc selectat").length).toBeGreaterThan(0);
    expect(screen.getByTestId("circle-image-sah")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Client e-mail/i })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:inscrierepcarad@gmail.com"),
    );
    expect(screen.getByRole("link", { name: /Deschide in Gmail/i })).toHaveAttribute(
      "href",
      expect.stringContaining("https://mail.google.com/mail/"),
    );
    await user.click(screen.getByRole("button", { name: /Copiaza textul/i }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Catre: inscrierepcarad@gmail.com"));
  });
});
