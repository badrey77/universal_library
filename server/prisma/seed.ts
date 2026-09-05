import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Belt-and-suspenders with getSettings()'s own lazy-create: a freshly
  // seeded database gets its policy singleton from the start.
  await prisma.setting.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      loanPeriodDays: 14,
      maxRenewals: 2,
      holdReadyDays: 3,
      defaultBorrowLimit: 5,
    },
  });

  const staffPassword = await bcrypt.hash("staff123", 10);
  const patronPassword = await bcrypt.hash("patron123", 10);

  const staff = await prisma.member.upsert({
    where: { email: "staff@library.test" },
    update: {},
    create: {
      name: "Amina Librarian",
      email: "staff@library.test",
      passwordHash: staffPassword,
      role: "STAFF",
      borrowLimit: 10,
    },
  });

  const patron = await prisma.member.upsert({
    where: { email: "patron@library.test" },
    update: {},
    create: {
      name: "Yusuf Reader",
      email: "patron@library.test",
      passwordHash: patronPassword,
      role: "PATRON",
      borrowLimit: 5,
    },
  });

  const books = [
    {
      isbn: "9780140449136",
      title: "The Odyssey",
      author: "Homer",
      description: "An epic journey home.",
      category: "Classic Literature",
      theme: "War and homecoming",
      copies: 2,
    },
    {
      isbn: "9782070360024",
      title: "L'Étranger",
      author: "Albert Camus",
      description: "Un roman existentialiste.",
      category: "Fiction",
      theme: "Absurdism and alienation",
      copies: 1,
    },
    {
      isbn: "9789953891234",
      title: "موسم الهجرة إلى الشمال",
      author: "Tayeb Salih",
      description: "رواية عربية كلاسيكية.",
      category: "Classic Literature",
      theme: "Colonialism and identity",
      copies: 2,
    },
    {
      isbn: "9780061120084",
      title: "To Kill a Mockingbird",
      author: "Harper Lee",
      description: "A story of justice and growing up.",
      category: "Historical Fiction",
      theme: "Justice and moral growth",
      copies: 3,
    },
  ];

  for (const b of books) {
    const book = await prisma.book.upsert({
      where: { isbn: b.isbn },
      update: {},
      create: {
        isbn: b.isbn,
        title: b.title,
        author: b.author,
        description: b.description,
        category: b.category,
        theme: b.theme,
      },
    });

    for (let i = 0; i < b.copies; i++) {
      const barcode = `${b.isbn}-C${i + 1}`;
      await prisma.copy.upsert({
        where: { barcode },
        update: {},
        create: {
          barcode,
          bookId: book.id,
          status: "AVAILABLE",
        },
      });
    }
  }

  console.log("Seeded:", { staff: staff.email, patron: patron.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
