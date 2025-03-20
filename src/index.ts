import { PrismaClient } from "@prisma/client";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const prisma = new PrismaClient();
const app = new Hono();

app.post("/customers", async (context) => {
  const { name, email, phoneNumber, address } = await context.req.json();
  try {
    const existEmail = await prisma.customers.findUnique({ where: { email } });
    const existPhoneNumber = await prisma.customers.findUnique({
      where: { phoneNumber },
    });

    if (existEmail || existPhoneNumber) {
      return context.json(
        { message: "Email or phone number already exist" },
        404
      );
    }

    const customer = await prisma.customers.create({
      data: {
        name: name,
        email: email,
        phoneNumber: phoneNumber,
        address: address,
      },
    });

    return context.json(customer, 201);
  } catch (error) {
    console.error("Error creating customer", error);
    return context.json({ message: "Error creating customer" }, 500);
  }
});

app.get("/customers", async (context) => {
  try {
    const customers = await prisma.customers.findMany();
    return context.json(customers);
  } catch (error) {
    console.error("No customer data found", error);
    return context.json({ message: "No customer Data Found" }, 404);
  }
});

app.post("/restaurants", async (context) => {
  const { name, location } = await context.req.json();
  try {
    const existName = await prisma.restaurants.findUnique({ where: { name } });
    if (existName) {
      return context.json({ message: "Restaurant name already exist" }, 404);
    }
    const restaurant = await prisma.restaurants.create({
      data: {
        name: name,
        location: location,
      },
    });
    return context.json(restaurant, 201);
  } catch (error) {
    console.error("Error creating a restaurant", error);
    return context.json({ message: "Error creating a restaurant" }, 500);
  }
});

app.post("/restaurants/:id/menu", async (context) => {
  const { id } = context.req.param();
  const { name, price } = await context.req.json();
  try {
    const existRestaurant = await prisma.restaurants.findUnique({
      where: {
        id: id,
      },
    });
    if (!existRestaurant) {
      return context.json({ message: "Restaurant not found" }, 404);
    }

    const menu = await prisma.menuItems.create({
      data: {
        name: name,
        price: price,
        restaurantId: id,
      },
    });
    return context.json(menu, 201);
  } catch (error) {
    console.error("Error finding restaurant", error);
    return context.json({ message: "Error finding restaurant" }, 404);
  }
});

app.get("/restaurants/:id/menu", async (context) => {
  const id = context.req.param("id");
  try {
    const restaurant = await prisma.restaurants.findUnique({
      where: { id },
    });
    if (!restaurant) {
      return context.json({ message: "Restaurant not found" }, 404);
    }

    const menuItems = await prisma.menuItems.findMany({
      where: { restaurantId: id },
    });
    if (menuItems.length === 0) {
      return context.json(
        { message: "No menu items found for this restaurant" },
        404
      );
    }

    return context.json({
      restaurantName: restaurant.name,
      menuItems: menuItems
    }, 200);
  } catch (error) {
    console.error("Error fetching menu items", error);
    return context.json({ message: "Error fetching menu items" }, 500);
  }
});

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
