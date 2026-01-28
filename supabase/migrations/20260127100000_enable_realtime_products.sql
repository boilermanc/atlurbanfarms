-- Enable realtime for products and product_categories tables
-- so that Supabase postgres_changes subscriptions work on the client

alter publication supabase_realtime add table products;
alter publication supabase_realtime add table product_categories;
alter publication supabase_realtime add table product_images;
