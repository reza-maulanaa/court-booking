import { SectionHeading } from "./section-heading";

const MAPS_EMBED_SRC =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d69724.25207744104!2d108.28847020693365!3d-6.347369172397135!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e6eb951a07812b7%3A0x9f2e03cfbf1b0b2f!2sIndramayu%2C%20Kec.%20Indramayu%2C%20Kabupaten%20Indramayu%2C%20Jawa%20Barat!5e1!3m2!1sid!2sid!4v1783735409440!5m2!1sid!2sid";
const MAPS_LINK = "https://maps.app.goo.gl/bkJcHx6B38q12V7v7";

const INFO = [
  {
    title: "Alamat",
    body: (
      <>
        Indramayu, Kec. Indramayu, Kabupaten Indramayu, Jawa Barat
        <br />
        <a
          href={MAPS_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-tf-green hover:text-tf-green-deep"
        >
          Buka di Google Maps ↗
        </a>
      </>
    ),
  },
  {
    title: "Jam operasional",
    body: <>Setiap hari · 08.00 – 23.00 WIB</>,
  },
];

export function LocationSection() {
  return (
    <div id="lokasi" className="scroll-mt-16 bg-white px-4 py-12 md:px-14 md:py-16">
      <SectionHeading kicker="Lokasi" title="Gampang dicari, parkir luas" />
      <div className="grid items-stretch gap-6 md:grid-cols-[1.3fr_1fr]">
        <div className="relative min-h-[300px] overflow-hidden rounded-[14px] border border-tf-ink/10">
          <iframe
            src={MAPS_EMBED_SRC}
            title="Lokasi Booking Futsal di Google Maps"
            width="100%"
            height="100%"
            style={{ border: 0, position: "absolute", inset: 0 }}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="flex flex-col gap-3.5">
          {INFO.map((item) => (
            <div
              key={item.title}
              className="rounded-xl bg-tf-mist px-[22px] py-5"
            >
              <div className="text-sm font-bold text-tf-ink">{item.title}</div>
              <div className="mt-1 text-sm leading-[1.6] text-tf-muted">
                {item.body}
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-tf-mist px-[22px] py-5">
            <div className="text-sm font-bold text-tf-ink">Kontak</div>
            <div className="mt-1 mb-3 text-sm leading-[1.6] text-tf-muted">
              WhatsApp 0812-3456-7890
            </div>
            <a
              href="#booking"
              className="inline-block rounded-lg bg-tf-green px-[18px] py-2.5 text-[13px] font-bold text-white hover:bg-tf-green-deep"
            >
              Booking via Website
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
