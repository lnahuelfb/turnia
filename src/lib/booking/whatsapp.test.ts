import { describe, expect, it } from "vitest";
import { buildClientBookingMessage, buildWaMeUrl } from "./whatsapp";

describe("buildWaMeUrl", () => {
  it("saca el + y todo lo no numérico, y codifica el texto", () => {
    const url = buildWaMeUrl("+54 9 11 2345-6789", "Hola, ¿qué tal?");
    expect(url).toBe("https://wa.me/5491123456789?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F");
  });
});

describe("buildClientBookingMessage", () => {
  it("arma el mensaje prearmado cliente → comerciante", () => {
    expect(
      buildClientBookingMessage({
        clientName: "Ana",
        serviceName: "Corte de pelo",
        professionalName: "Juan",
        whenText: "lunes 5 de enero a las 10:00",
      }),
    ).toBe(
      "¡Hola! Soy Ana, reservé un turno para Corte de pelo con Juan el lunes 5 de enero a las 10:00.",
    );
  });
});
