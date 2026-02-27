"use client";

export default function ContactForm() {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
      }}
      aria-label="Formularz kontaktowy"
    >
      <div className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-dark-brown"
          >
            Imi&#281; i nazwisko
          </label>
          <input
            id="name"
            type="text"
            aria-label="Imię i nazwisko"
            className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-dark-brown"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            aria-label="Adres email"
            className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="subject"
            className="mb-1 block text-sm font-medium text-dark-brown"
          >
            Temat
          </label>
          <select
            id="subject"
            aria-label="Temat wiadomości"
            className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
          >
            <option>Zapytanie og&oacute;lne</option>
            <option>Konsygnacja</option>
            <option>Wycena</option>
            <option>Wsp&oacute;&#322;praca</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="message"
            className="mb-1 block text-sm font-medium text-dark-brown"
          >
            Wiadomo&#347;&#263;
          </label>
          <textarea
            id="message"
            rows={6}
            aria-label="Treść wiadomości"
            className="w-full rounded-lg border border-beige-dark bg-white px-4 py-3 text-sm text-dark-brown focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-gold-dark hover:scale-[1.02]"
        >
          Wy&#347;lij wiadomo&#347;&#263;
        </button>
      </div>
    </form>
  );
}
