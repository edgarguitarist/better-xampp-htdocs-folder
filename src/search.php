<?php
//GET THE LAST SEARCH PARAMS OR SET DEFAULT VALUES
$show_type = $_GET['F'] ?? '2';
$sorter = strtoupper($_GET['C'] ?? 'N');
$order = strtoupper($_GET['O'] ?? 'A');
$match = strtoupper($_GET['P'] ?? '');

//use the index to value
$shows = ['Plain list', 'Grid', 'Table list'];
//use a letter like an index to value
$sorts = ["N" => "Name", "M" => "Date Modified", "S" => "Size", "D" => "Description"];
$orders = ["A" => "Ascending", "D" => "Descending"];

function options($array, $selected)
{
    foreach ($array as $key => $show) {
        if ($selected == $key) {
            echo "<option value='$key' selected>$show</option>";
        } else {
            echo "<option value='$key'>$show</option>";
        }
    }
}

?>

<form action="" method="get">
     <!-- <label for="shows">Show me a</label>
    <select id="shows" name="F" title="Show me a">
        <?php options($shows, $show_type) ?>
    </select> -->
    <label for="sorts">Sorted by</label>
    <select id="sorts" name="C" title="Sorted by">
        <?php options($sorts, $sorter) ?>
    </select>
    <select id="orders" name="O" title="Order By">
        <?php options($orders, $order) ?>
    </select>
    <label for="match">Matching</label>
    <input id="match" type="text" name="P" value="<?= $match ?>" autofocus />
    <input type="submit" name="X" class="btn" value="Search 🔎" />
</form>